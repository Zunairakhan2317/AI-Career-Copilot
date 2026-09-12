"""
Mock Interview Service

Two-stage AI flow:
  1. Live chat uses Groq for low conversational latency.
  2. End-of-session evaluation uses Gemini for a deeper scorecard.

Storage: uses the existing `interview_sessions` Supabase table
(id, user_id, target_role, chat_history jsonb, feedback_scorecard jsonb,
created_at). The `chat_history` field stores an array of ChatTurn objects.
"""

from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from typing import Any

from database import supabase
from llm_client import call_llm


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _is_usable_interview_response(text: str) -> bool:
    """Reject model metadata/numeric output accidentally returned as chat."""
    normalized = text.strip()
    if not normalized:
        return False
    try:
        float(normalized)
    except ValueError:
        return True
    return False


def get_resume_for_user(resume_id: str, user_id: str) -> dict | None:
    if not resume_id:
        return None
    response = (
        supabase.table("resumes")
        .select("parsed_data")
        .eq("id", resume_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


def fetch_session(session_id: str, user_id: str) -> dict | None:
    response = (
        supabase.table("interview_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


def update_session_chat(session_id: str, chat_history: list[dict], target_role: str | None = None) -> None:
    update_payload: dict[str, Any] = {"chat_history": chat_history}
    if target_role:
        update_payload["target_role"] = target_role
    (
        supabase.table("interview_sessions")
        .update(update_payload)
        .eq("id", session_id)
        .execute()
    )


def derive_target_role(jd: str, fallback: str | None = None) -> str:
    """Quick heuristic — ask Groq to extract a role title."""
    if fallback:
        return fallback
    try:
        out = call_llm(
            f"Extract the job title from this job description in 2-5 words. "
            f"Return ONLY the title, nothing else.\n\n{jd[:1500]}",
            provider="groq",
        )
        return out.strip().strip('"').strip("'") or "Software Engineer"
    except Exception:
        return "Software Engineer"


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

def start_interview_session(
    user_id: str,
    job_description: str,
    resume_id: str | None = None,
    target_role: str | None = None,
    total_questions: int = 5,
) -> dict:
    """Create a new interview session row and return the opening question."""
    role = derive_target_role(job_description, target_role)

    # Pull resume context if available
    resume_data = get_resume_for_user(resume_id, user_id) if resume_id else None
    parsed = (resume_data or {}).get("parsed_data") if resume_data else None

    # Build the system prompt for Groq
    system_prompt = _build_system_prompt(role, job_description, parsed, total_questions)

    # Opening question (always an intro)
    opening_prompt = (
        f"{system_prompt}\n\n"
        "Start the interview. Greet the candidate briefly by their field/role "
        "(do not invent a name) and ask your first question. The first question "
        "should be a short introductory question (e.g. 'Tell me about yourself "
        "and why you're interested in this role'). Keep it to 2-3 sentences max."
    )

    try:
        opening = call_llm(opening_prompt, provider="groq")
    except Exception as e:
        raise RuntimeError(f"Failed to start interview: {e}")

    opening = opening.strip()

    # Persist session
    initial_history = [
        {
            "role": "assistant",
            "content": opening,
            "timestamp": _now_iso(),
            "question_type": "intro",
        }
    ]

    insert_payload = {
        "user_id": user_id,
        "target_role": role,
        "chat_history": initial_history,
        "feedback_scorecard": None,
    }

    response = supabase.table("interview_sessions").insert(insert_payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create interview session.")

    session = response.data[0]

    return {
        "session_id": session["id"],
        "target_role": role,
        "total_questions": total_questions,
        "question_number": 1,
        "is_complete": False,
        "assistant_message": opening,
        "chat_history": initial_history,
    }


def send_message(
    session_id: str, user_id: str, user_message: str
) -> dict:
    """Append user message, generate next AI response via Groq, return updated state."""
    session = fetch_session(session_id, user_id)
    if not session:
        raise ValueError("Interview session not found.")

    history = list(session.get("chat_history") or [])
    target_role = session.get("target_role") or "this role"

    # Append user turn
    history.append({
        "role": "user",
        "content": user_message.strip(),
        "timestamp": _now_iso(),
    })

    # Determine if we should end the session.
    # We approximate "end" by counting assistant question turns and comparing
    # to a target (5 default). The user can also force-end via /api/interview/end.
    question_count = sum(1 for t in history if t.get("role") == "assistant")
    target_questions = session.get("total_questions") or 5

    # Build messages for Groq
    system_prompt = (
        f"You are an experienced technical interviewer for a {target_role} position. "
        f"You ask one question at a time. Mix technical and behavioral questions. "
        f"Keep each question to 2-4 sentences. Do not give long preambles. "
        f"After the candidate answers, you may briefly acknowledge (1 sentence) "
        f"then move to the next question. Be encouraging but rigorous."
    )

    # Convert history to a conversation format Groq can use
    conversation = [{"role": "system", "content": system_prompt}]
    for turn in history:
        conversation.append({"role": turn["role"], "content": turn["content"]})

    # Add an instruction nudge based on question count
    if question_count >= target_questions:
        # Final question already asked; wrap up
        closing_prompt_prefix = (
            f"{system_prompt}\n\n"
            f"This was the final question. Thank the candidate warmly, "
            f"give a 1-2 sentence summary of what you observed, and wish them luck. "
            f"Do NOT ask another question."
        )
        conversation = [conversation[0]] + [{"role": "system", "content": closing_prompt_prefix}] + conversation[1:]
    else:
        # Ask next question
        next_q_num = question_count + 1
        nudge = (
            f"\n\n[Coach note: This is question {next_q_num} of {target_questions}. "
            f"Ask your next question now. Vary between technical and behavioral. "
            f"Reference the candidate's earlier answers when natural.]"
        )
        conversation[0]["content"] = conversation[0]["content"] + nudge

    try:
        from llm_client import groq_client as _groq_client
        if _groq_client is None:
            raise RuntimeError("GROQ_API_KEY is not set.")
        # Build the prompt from the conversation and use the unified caller
        # (which has built-in model fallbacks) so we don't hardcode a model
        # the key might not have access to.
        from llm_client import call_llm as _call_llm
        prompt_text = "\n".join(
            f"{turn['role'].upper()}: {turn['content']}" for turn in conversation
        )
        assistant_message = _call_llm(
            prompt_text,
            provider="groq",
            model=None,  # use fallback list
        ).strip()
        if not _is_usable_interview_response(assistant_message):
            raise RuntimeError("The language model returned a non-conversational response.")
    except Exception as e:
        raise RuntimeError(f"Failed to generate interview response: {e}")

    # Determine question type heuristically
    q_type = "followup" if question_count <= target_questions and any(
        kw in assistant_message.lower() for kw in ["tell me about a time", "describe a situation", "give me an example"]
    ) else None
    if not q_type:
        if "?" in assistant_message and any(
            tech_kw in assistant_message.lower()
            for tech_kw in ["how does", "explain", "what is", "implement", "algorithm", "complexity", "design", "code", "function", "api", "database", "system"]
        ):
            q_type = "technical"
        elif any(
            beh_kw in assistant_message.lower()
            for beh_kw in ["tell me about", "describe a", "have you", "walk me through", "why", "conflict", "team", "challenge"]
        ):
            q_type = "behavioral"

    # Append assistant turn
    history.append({
        "role": "assistant",
        "content": assistant_message,
        "timestamp": _now_iso(),
        "question_type": q_type,
    })

    is_complete = question_count >= target_questions

    # Persist
    update_session_chat(session_id, history)

    return {
        "session_id": session_id,
        "target_role": target_role,
        "question_number": min(question_count, target_questions),
        "total_questions": target_questions,
        "is_complete": is_complete,
        "assistant_message": assistant_message,
        "chat_history": history,
    }


def end_interview_session(session_id: str, user_id: str) -> dict:
    """Generate a Gemini-based scorecard for the full transcript."""
    session = fetch_session(session_id, user_id)
    if not session:
        raise ValueError("Interview session not found.")

    history = session.get("chat_history") or []
    target_role = session.get("target_role") or "this role"

    # Build a transcript summary for the LLM
    transcript_lines = []
    for t in history:
        speaker = "Interviewer" if t.get("role") == "assistant" else "Candidate"
        transcript_lines.append(f"{speaker}: {t.get('content', '')}")
    transcript = "\n\n".join(transcript_lines)

    eval_prompt = f"""You are a senior interview evaluator. You conducted a mock
interview for a {target_role} position. Below is the full transcript.

Rate the candidate across multiple dimensions and return ONLY a valid JSON
object (no markdown, no commentary) matching this exact structure:

{{
  "overall_score": 0-100,
  "technical_knowledge": 0-100,
  "communication": 0-100,
  "confidence": 0-100,
  "problem_solving": 0-100,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["area to improve 1", "area to improve 2", "area to improve 3"],
  "per_question_feedback": [
    {{"question_type": "technical|behavioral|intro", "score": 0-100, "note": "1-2 sentence feedback"}},
    ...one entry per interviewer question...
  ],
  "recommendation": "A 2-3 sentence overall recommendation, including whether the candidate should apply, what to focus on, and a hire/no-hire lean."
}}

RULES:
- All scores must be integers from 0 to 100.
- Be honest and constructive. Don't inflate scores.
- per_question_feedback should have one entry for each interviewer question in the transcript (intro + technical + behavioral combined).

TRANSCRIPT:
---
{transcript}
---
"""

    try:
        llm_response = call_llm(eval_prompt, provider="auto")
    except Exception as e:
        raise RuntimeError(f"Failed to evaluate interview: {e}")

    cleaned = _strip_fences(llm_response)
    try:
        scorecard = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: store the raw output and a minimal scorecard
        scorecard = {
            "overall_score": 0,
            "technical_knowledge": 0,
            "communication": 0,
            "confidence": 0,
            "problem_solving": 0,
            "strengths": [],
            "improvements": ["Could not parse AI evaluation."],
            "per_question_feedback": [],
            "recommendation": llm_response[:500],
        }

    # Persist the scorecard
    (
        supabase.table("interview_sessions")
        .update({"feedback_scorecard": scorecard})
        .eq("id", session_id)
        .execute()
    )

    return {
        "session_id": session_id,
        "target_role": target_role,
        "scorecard": scorecard,
        "chat_history": history,
    }


def get_user_sessions(user_id: str) -> list[dict]:
    response = (
        supabase.table("interview_sessions")
        .select("id, user_id, target_role, created_at, feedback_scorecard")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_system_prompt(
    role: str, jd: str, parsed_resume: dict | None, total_questions: int
) -> str:
    jd_excerpt = jd[:2500] if jd else "No job description provided."
    resume_excerpt = ""
    if parsed_resume:
        try:
            resume_excerpt = json.dumps(parsed_resume, indent=2)[:2000]
        except Exception:
            resume_excerpt = ""

    parts = [
        f"You are an experienced, friendly, and rigorous interviewer for a {role} position.",
        f"You will ask exactly {total_questions} questions total (including the intro).",
        "Mix technical and behavioral questions, grounded in the candidate's resume AND the job description below.",
        "Ask ONE question at a time. Keep each question to 2-4 sentences.",
        "After the candidate answers, briefly acknowledge (1 short sentence) then ask the next question.",
        "Do NOT give long preambles. Stay in character as an interviewer.",
    ]

    if jd:
        parts.append("\nJOB DESCRIPTION:\n" + jd_excerpt)
    if resume_excerpt:
        parts.append("\nCANDIDATE RESUME (parsed):\n" + resume_excerpt)

    return "\n".join(parts)
