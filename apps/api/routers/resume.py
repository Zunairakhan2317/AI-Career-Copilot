import os
import shutil
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from database import supabase
from services.pipeline import build_resume_graph
from services.ats_service import generate_tailored_resume, TailorRequest

router = APIRouter(prefix="/resume", tags=["resume"])

_graph = None


def _get_graph():
    """Build the LangGraph pipeline once and reuse it across requests."""
    global _graph
    if _graph is None:
        _graph = build_resume_graph()
    return _graph


@router.post("/upload")
async def upload_resume(user_id: str = Form(...), file: UploadFile = File(...)):
    """
    Accepts a resume PDF, runs it through the Parse -> Validate -> Enrich & Store
    pipeline, and returns the result (including any partial-failure info).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        graph = _get_graph()
        result = graph.invoke({"file_path": tmp_path, "user_id": user_id})

        if result.get("store_error") or result.get("validation_error") or result.get("parse_error"):
            # Pipeline ran but didn't fully succeed — surface the details instead of a bare 500.
            return {
                "success": bool(result.get("stored")),
                "resume_id": result.get("resume_id"),
                "parse_error": result.get("parse_error"),
                "validation_error": result.get("validation_error"),
                "store_error": result.get("store_error"),
            }

        return {"success": True, "resume_id": result.get("resume_id")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("/{user_id}")
def get_resumes(user_id: str):
    """
    Returns every parsed resume on file for a user, most recent first.
    """
    try:
        response = (
            supabase.table("resumes")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"user_id": user_id, "resumes": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tailor")
def tailor_resume(payload: TailorRequest):
    """
    Generates an ATS-tailored version of a stored resume against a given
    job description. Logic lives in services/ats_service.py.
    """
    try:
        return generate_tailored_resume(payload.resume_id, payload.job_description)
    except HTTPException:
        # Already a proper HTTPException (e.g. 404 resume not found,
        # 400 empty job description) raised inside ats_service — let its
        # original status code/detail pass through instead of masking it as 500.
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))