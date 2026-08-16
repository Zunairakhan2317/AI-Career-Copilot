"""
Resume Ingestion Pipeline: Parse Node -> Validate Node -> Enrich & Store Node

Parse Node delegates raw text extraction to services/pdf_service.py.
Uses the llm_client singleton (llm_client.py) for Gemini calls, so the
Groq/Gemini key handling stays in one place. Reuses the shared Supabase
client from database.py (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env)
for the storage step, so there's a single Supabase connection in the app.

Usage (from FastAPI or a script):
    from services.pipeline import build_resume_graph

    graph = build_resume_graph()
    result = graph.invoke({"file_path": "resume.pdf", "user_id": "abc-123"})
"""

from __future__ import annotations
import re
import json

from langgraph.graph import StateGraph, END

from llm_client import llm_client
from schemas import ResumePipelineState, ResumeData, ResumeRow, SkillRow
from database import supabase
from services.pdf_service import extract_resume_text

MAX_VALIDATE_ATTEMPTS = 2


# ---------------------------------------------------------------------------
# Parse Node
# ---------------------------------------------------------------------------

def parse_node(state: ResumePipelineState) -> dict:
    """Extracts raw text from the resume PDF via services/pdf_service.py."""
    return extract_resume_text(state.file_path)


# ---------------------------------------------------------------------------
# Validate Node
# ---------------------------------------------------------------------------

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


def validate_node(state: ResumePipelineState) -> dict:
    """Uses llm_client.generate_structured_data (Gemini) to extract + validate a ResumeData object."""
    if not state.raw_text:
        return {"validation_error": f"No raw_text available (parse failed: {state.parse_error})"}

    retry_context = ""
    last_error = None

    for attempt in range(1, MAX_VALIDATE_ATTEMPTS + 1):
        prompt = EXTRACTION_PROMPT_TEMPLATE.format(
            resume_text=state.raw_text,
            retry_context=retry_context,
        )

        try:
            raw_response = llm_client.generate_structured_data(prompt)
            clean_json = _strip_json_fences(raw_response)
            data_dict = json.loads(clean_json)
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


# ---------------------------------------------------------------------------
# Enrich & Store Node
# ---------------------------------------------------------------------------

def enrich_and_store_node(state: ResumePipelineState) -> dict:
    """Writes the validated resume + its skills into Supabase (resumes, skills tables)."""
    if state.parsed_resume is None:
        return {
            "stored": False,
            "store_error": f"No validated resume to store. Upstream error: {state.validation_error}",
        }

    resume_data = state.parsed_resume

    resume_row = ResumeRow(
        user_id=state.user_id,
        file_path=state.file_path,
        parsed_data=resume_data.model_dump(mode="json"),
    )

    try:
        resume_insert = supabase.table("resumes").insert(resume_row.model_dump()).execute()
        resume_id = resume_insert.data[0]["id"]

        # Note: skills table has no resume_id column — skills are stored per
        # user_id, not linked to a specific resume row.
        skill_rows = [
            SkillRow(
                user_id=state.user_id,
                skill_name=skill.name,
                category=skill.category,
            ).model_dump()
            for skill in resume_data.skills
        ]

        if skill_rows:
            supabase.table("skills").insert(skill_rows).execute()

        return {"resume_id": resume_id, "stored": True, "store_error": None}

    except Exception as e:
        return {"resume_id": None, "stored": False, "store_error": str(e)}


# ---------------------------------------------------------------------------
# Graph wiring
# ---------------------------------------------------------------------------

def _route_after_parse(state: ResumePipelineState) -> str:
    if state.parse_error or not state.raw_text:
        return "failed"
    return "continue"


def _route_after_validate(state: ResumePipelineState) -> str:
    if state.validation_error or state.parsed_resume is None:
        return "failed"
    return "continue"


def build_resume_graph():
    graph = StateGraph(ResumePipelineState)

    graph.add_node("parse", parse_node)
    graph.add_node("validate", validate_node)
    graph.add_node("enrich_store", enrich_and_store_node)

    graph.set_entry_point("parse")

    graph.add_conditional_edges("parse", _route_after_parse, {"continue": "validate", "failed": END})
    graph.add_conditional_edges("validate", _route_after_validate, {"continue": "enrich_store", "failed": END})
    graph.add_edge("enrich_store", END)

    return graph.compile()


if __name__ == "__main__":
    # quick manual smoke test
    resume_graph = build_resume_graph()
    result = resume_graph.invoke({
        "file_path": "sample_resume.pdf",
        "user_id": "test-user-123",
    })
    print(result)