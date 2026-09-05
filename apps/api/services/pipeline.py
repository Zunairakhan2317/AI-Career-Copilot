"""
Resume Ingestion Pipeline: Parse -> Validate -> Enrich & Store

Direct synchronous pipeline (no LangGraph overhead). Each step's errors
are surfaced clearly to the caller.

Usage (from FastAPI):
    from services.pipeline import process_resume_upload
    result = process_resume_upload(file_path, user_id)
"""

from __future__ import annotations
import re
import json

from llm_client import call_llm
from schemas import ResumeData, ResumeRow, SkillRow
from database import supabase
from services.pdf_service import extract_resume_text

MAX_VALIDATE_ATTEMPTS = 2


EXTRACTION_PROMPT_TEMPLATE = """You are a resume parser. Extract structured data from the resume text below.

Return ONLY a raw JSON object — no markdown fences, no commentary, no preamble.
The JSON MUST match this shape exactly (omit fields you can't find, don't invent data):

{{
  "contact": {{"full_name": str, "email": str|null, "phone": str|null, "location": str|null,
               "linkedin": str|null, "github": str|null, "portfolio": str|null}},
  "summary": str|null,
  "experience": [{{"title": str, "company": str, "start_date": str|null, "end_date": str|null,
                   "description": str|null, "is_current": bool}}],
  "education": [{{"institution": str, "degree": str|null, "field_of_study": str|null,
                  "start_date": str|null, "end_date": str|null, "gpa": str|null}}],
  "skills": [{{"name": str, "category": "technical"|"soft"|"tool"|"language"|"certification"|"other",
              "proficiency": "beginner"|"intermediate"|"advanced"|"expert"|null}}],
  "certifications": [str]
}}

RULES:
- Do NOT hallucinate skills, dates, or companies that aren't in the text.
- If a field is genuinely absent, use null (or empty list for arrays) — never guess.
- category defaults to "other" if unclear; proficiency defaults to null unless stated.

RESUME TEXT:
---
{resume_text}
---
{retry_context}"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _safe_json_loads(text: str) -> dict:
    """
    Parse JSON leniently. LLMs sometimes emit raw newlines/tabs inside string
    values, which strict JSON rejects. We try strict first, then fall back to
    strict=False (which allows control chars inside strings), then to a more
    aggressive cleanup if even that fails.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Lenient parse: allows literal control characters inside string values.
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        pass

    # Last resort: strip raw newlines/tabs that sit inside string values.
    # Replace any literal control char (except inside a JSON string we don't
    # know the bounds of) with the escape sequence.
    sanitized = re.sub(r'[\x00-\x1f]', lambda m: "\\n" if m.group(0) == "\n" else "\\t", text)
    return json.loads(sanitized)


def _parse_resume_text(file_path: str) -> dict:
    """Step 1: Extract raw text from PDF."""
    return extract_resume_text(file_path)


def _validate_resume_text(raw_text: str) -> dict:
    """Step 2: Ask LLM to extract structured data, validate as ResumeData."""
    retry_context = ""
    last_error = None

    for attempt in range(1, MAX_VALIDATE_ATTEMPTS + 1):
        prompt = EXTRACTION_PROMPT_TEMPLATE.format(
            resume_text=raw_text,
            retry_context=retry_context,
        )

        try:
            raw_response = call_llm(prompt, provider="auto")
            clean_json = _strip_json_fences(raw_response)
            data_dict = _safe_json_loads(clean_json)
            resume_data = ResumeData(**data_dict)

            return {
                "parsed_resume": resume_data,
                "validation_error": None,
                "validation_attempts": attempt,
            }

        except Exception as e:
            last_error = str(e)
            retry_context = (
                f"\nYour previous response failed validation with this error:\n{last_error}\n"
                f"Fix the JSON and try again. Return ONLY the corrected JSON object."
            )
            continue

    return {
        "parsed_resume": None,
        "validation_error": f"Failed after {MAX_VALIDATE_ATTEMPTS} attempts. Last error: {last_error}",
        "validation_attempts": MAX_VALIDATE_ATTEMPTS,
    }


def _store_resume(parsed_resume: ResumeData, user_id: str, file_path: str) -> dict:
    """Step 3: Store the validated resume + skills in Supabase."""
    parsed_dict = parsed_resume.model_dump(mode="json")

    resume_row = ResumeRow(
        user_id=user_id,
        file_path=file_path,
        parsed_data=parsed_dict,
    )

    resume_insert = supabase.table("resumes").insert(resume_row.model_dump()).execute()
    if not resume_insert.data:
        return {
            "resume_id": None,
            "stored": False,
            "store_error": f"Supabase insert returned no data. Response: {resume_insert}",
        }
    resume_id = resume_insert.data[0]["id"]

    skill_rows = [
        SkillRow(
            user_id=user_id,
            skill_name=skill.name,
            category=skill.category,
        ).model_dump()
        for skill in parsed_resume.skills
    ]

    if skill_rows:
        supabase.table("skills").insert(skill_rows).execute()

    return {"resume_id": resume_id, "stored": True, "store_error": None}


def process_resume_upload(file_path: str, user_id: str) -> dict:
    """
    Run the full resume processing pipeline synchronously.

    Returns a dict with keys:
        resume_id (str|None)
        parsed_resume (ResumeData|None)
        parse_error (str|None)
        validation_error (str|None)
        store_error (str|None)
    """
    # Step 1: parse
    parse_result = _parse_resume_text(file_path)
    if parse_result.get("parse_error") or not parse_result.get("raw_text"):
        return {
            "resume_id": None,
            "parsed_resume": None,
            "parse_error": parse_result.get("parse_error") or "PDF text extraction returned no text.",
            "validation_error": None,
            "store_error": None,
        }

    # Step 2: validate
    validation_result = _validate_resume_text(parse_result["raw_text"])
    if validation_result.get("validation_error") or not validation_result.get("parsed_resume"):
        return {
            "resume_id": None,
            "parsed_resume": None,
            "parse_error": None,
            "validation_error": validation_result.get("validation_error") or "LLM did not return valid resume data.",
            "store_error": None,
        }

    # Step 3: store
    try:
        store_result = _store_resume(
            validation_result["parsed_resume"],
            user_id,
            file_path,
        )
    except Exception as e:
        return {
            "resume_id": None,
            "parsed_resume": validation_result["parsed_resume"],
            "parse_error": None,
            "validation_error": None,
            "store_error": f"{type(e).__name__}: {str(e)[:500]}",
        }

    return {
        "resume_id": store_result.get("resume_id"),
        "parsed_resume": validation_result["parsed_resume"],
        "parse_error": None,
        "validation_error": None,
        "store_error": store_result.get("store_error"),
    }


# ---------------------------------------------------------------------------
# LangGraph wrapper kept for API compatibility (calls the direct pipeline)
# ---------------------------------------------------------------------------

def build_resume_graph():
    """
    Kept for backward compatibility. Returns a thin LangGraph wrapper
    around process_resume_upload. Not used by the live router anymore.
    """
    from langgraph.graph import StateGraph, END
    from schemas import ResumePipelineState

    def parse_node(state):
        return _parse_resume_text(state.file_path)

    def validate_node(state):
        if not state.raw_text:
            return {"validation_error": "No raw_text available."}
        return _validate_resume_text(state.raw_text)

    def enrich_store_node(state):
        if state.parsed_resume is None:
            return {"store_error": "No validated resume to store."}
        return _store_resume(state.parsed_resume, state.user_id, state.file_path)

    def _route_after_parse(state):
        return "failed" if (state.parse_error or not state.raw_text) else "continue"

    def _route_after_validate(state):
        return "failed" if (state.validation_error or state.parsed_resume is None) else "continue"

    graph = StateGraph(ResumePipelineState)
    graph.add_node("parse", parse_node)
    graph.add_node("validate", validate_node)
    graph.add_node("enrich_store", enrich_store_node)
    graph.set_entry_point("parse")
    graph.add_conditional_edges("parse", _route_after_parse, {"continue": "validate", "failed": END})
    graph.add_conditional_edges("validate", _route_after_validate, {"continue": "enrich_store", "failed": END})
    graph.add_edge("enrich_store", END)
    return graph.compile()


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m services.pipeline <path-to-pdf>")
        sys.exit(1)
    result = process_resume_upload(sys.argv[1], "test-user")
    print(json.dumps({k: str(v) if v is not None else None for k, v in result.items()}, indent=2, default=str))
