"""
routers/resume.py

FastAPI routes for resume upload, retrieval, and ATS tailoring.

Confirmed against the real files:
- database.py exposes a ready-to-use Supabase client, imported as `supabase`.
- services/pipeline.py (Hadiya's Task 2, LangGraph) exposes:
      build_resume_graph() -> compiled graph
      graph.invoke({"file_path": str, "user_id": str}) -> dict
  The returned dict includes (among other keys) "stored": bool,
  "resume_id": str|None, and on failure one of "parse_error",
  "validation_error", or "store_error" explaining what went wrong.
  The pipeline already does parse -> validate -> enrich & store into
  Supabase internally, so this router just calls it and reports the result.
"""

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from database import supabase  # <-- adjust if the real client import differs
from services.pipeline import build_resume_graph
from services.ats_service import tailor_resume

router = APIRouter(prefix="/resume", tags=["resume"])
# NOTE: main.py already adds "/api" when it does
# app.include_router(resume.router, prefix="/api") — so the final paths
# come out to /api/resume/upload, /api/resume/{user_id}, /api/resume/tailor.
# Don't add "/api" here too, or you'll get /api/api/resume/...

UPLOAD_DIR = Path("uploads/resumes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Build the LangGraph graph once and reuse it across requests instead of
# recompiling it on every upload.
_resume_graph = None


def _get_resume_graph():
    global _resume_graph
    if _resume_graph is None:
        _resume_graph = build_resume_graph()
    return _resume_graph


class TailorRequest(BaseModel):
    user_id: str
    job_description: str
    company_name: Optional[str] = None
    provider: str = "gemini"


@router.post("/upload")
async def upload_resume(user_id: str = Form(...), file: UploadFile = File(...)):
    """
    POST /api/resume/upload
    Accepts a PDF resume, saves it to disk, and runs it through Hadiya's
    LangGraph pipeline (parse -> validate -> enrich & store into Supabase).
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_id = uuid.uuid4().hex
    saved_path = UPLOAD_DIR / f"{user_id}_{file_id}.pdf"

    contents = await file.read()
    with open(saved_path, "wb") as f:
        f.write(contents)

    graph = _get_resume_graph()
    result = graph.invoke({"file_path": str(saved_path), "user_id": user_id})

    if result.get("stored"):
        return {"status": "success", "resume_id": result.get("resume_id")}

    # Parse, validate, or store failed somewhere in the pipeline — surface
    # the most specific error available instead of a generic 500.
    error = (
        result.get("store_error")
        or result.get("validation_error")
        or result.get("parse_error")
        or "Unknown pipeline failure."
    )
    raise HTTPException(status_code=422, detail=f"Resume processing failed: {error}")


@router.get("/{user_id}")
async def get_resume(user_id: str):
    """
    GET /api/resume/{user_id}
    Fetch the most recently uploaded resume for a user.
    """
    res = (
        supabase.table("resumes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="No resume found for this user.")

    return res.data[0]


@router.post("/tailor")
async def tailor_resume_endpoint(payload: TailorRequest):
    """
    POST /api/resume/tailor
    Generates ATS-tailored bullet points + a cover letter for a given job
    description, based on the user's most recently stored resume.
    """
    res = (
        supabase.table("resumes")
        .select("*")
        .eq("user_id", payload.user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=404,
            detail="No resume found for this user. Upload one first.",
        )

    parsed_resume = res.data[0].get("parsed_data", {})

    result = tailor_resume(
        parsed_resume=parsed_resume,
        job_description=payload.job_description,
        company_name=payload.company_name,
        provider=payload.provider,
    )

    return {"user_id": payload.user_id, **result}