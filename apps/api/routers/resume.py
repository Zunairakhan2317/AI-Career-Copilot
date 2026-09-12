import os
import shutil
import tempfile
from schemas import JobDescriptionRequest, TailorRequest

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from database import supabase
from services.pipeline import process_resume_upload
from services.ats_service import generate_tailored_resume
from services.job_service import analyze_resume_jd

router = APIRouter(tags=["resume"])


@router.post("/resume/upload")
async def upload_resume(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    job_description: str = Form(default="")
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Run direct pipeline (no LangGraph)
        result = process_resume_upload(tmp_path, user_id)

        if result.get("parse_error"):
            raise HTTPException(status_code=422, detail=f"Parse error: {result['parse_error']}")
        if result.get("validation_error"):
            raise HTTPException(status_code=422, detail=f"Validation error: {result['validation_error']}")
        if result.get("store_error"):
            raise HTTPException(status_code=500, detail=f"Storage error: {result['store_error']}")

        resume_id = result.get("resume_id")
        parsed_resume = result.get("parsed_resume")
        parsed_data = (
            parsed_resume.model_dump(mode="json")
            if parsed_resume is not None
            else None
        )

        # If JD was provided, also analyze the match
        if job_description.strip():
            try:
                jd_row = JobDescriptionRequest(raw_text=job_description)
                jd_insert = supabase.table("job_descriptions").insert(
                    jd_row.model_dump()
                ).execute()
                jd_id = jd_insert.data[0]["id"]

                analysis_result = analyze_resume_jd(
                    resume_id=resume_id,
                    jd_id=jd_id,
                    user_id=user_id
                )
                return {
                    "success": True,
                    "resume_id": resume_id,
                    "parsed_data": parsed_data,
                    "analysis": analysis_result,
                }
            except Exception as e:
                # Upload succeeded but analysis failed — still return the parsed data
                return {
                    "success": True,
                    "resume_id": resume_id,
                    "parsed_data": parsed_data,
                    "analysis_error": f"{type(e).__name__}: {str(e)[:200]}",
                }

        return {
            "success": True,
            "resume_id": resume_id,
            "parsed_data": parsed_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)[:500]}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@router.get("/resume/{user_id}")
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


@router.post("/resume/tailor")
def tailor_resume(payload: TailorRequest):
    """
    Rewrite the candidate's resume experience bullets for ATS compliance
    against a target job description. Returns structured JSON content
    AND a base64-encoded .docx file ready for download.
    """
    try:
        result = generate_tailored_resume(
            resume_id=payload.resume_id,
            user_id=payload.user_id,
            job_description=payload.job_description,
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
