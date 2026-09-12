from fastapi import APIRouter
from pydantic import BaseModel

from services.job_service import calculate_job_match


router = APIRouter(
    prefix="/job-match",
    tags=["job-match"]
)


class JobMatchRequest(BaseModel):
    user_id: str
    job_description: str


@router.post("/")
def match_job(payload: JobMatchRequest):
    """
    Compare the user's latest resume with a job description
    and return an AI-generated match score.
    """
    return calculate_job_match(
        user_id=payload.user_id,
        job_description=payload.job_description,
    )