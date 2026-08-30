import json

from fastapi import HTTPException
from pydantic import BaseModel

from database import supabase
from llm_client import call_llm


class TailorRequest(BaseModel):
    resume_id: str
    job_description: str


def get_resume_by_id(resume_id: str) -> dict:
    """
    Fetch a specific resume (by its own id, not just latest-for-user) from Supabase.
    """

    response = (
        supabase.table("resumes")
        .select("id, user_id, parsed_data, created_at")
        .eq("id", resume_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="No resume found with this resume_id."
        )

    return response.data[0]


def generate_tailored_resume(resume_id: str, job_description: str) -> dict:
    """
    Rewrites the candidate's resume bullets to better match a job description,
    and drafts a short tailored cover letter, using the existing LLM client.
    """

    if not job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Job description cannot be empty."
        )

    # ---------------------------------------------------------
    # 1. Get the resume being tailored
    # ---------------------------------------------------------
    resume = get_resume_by_id(resume_id)

    parsed_data = resume.get("parsed_data")

    if not parsed_data:
        raise HTTPException(
            status_code=404,
            detail="Resume exists but contains no parsed data."
        )

    # ---------------------------------------------------------
    # 2. Create the LLM prompt
    # ---------------------------------------------------------
    prompt = f"""
You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist.

Rewrite the candidate's resume content to better match the job description below,
and draft a short, tailored cover letter.

Candidate Resume:
{json.dumps(parsed_data, indent=2)}

Job Description:
{job_description}

Use only information present in the resume. Do not invent skills, employers,
titles, or experience that aren't already there — rephrase and reprioritize
existing content to align with the job description's keywords and requirements.

Return ONLY valid JSON using exactly this structure:

{{
    "tailored_summary": "",
    "tailored_experience": [
        {{"title": "", "company": "", "bullets": []}}
    ],
    "highlighted_skills": [],
    "ats_keywords_used": [],
    "cover_letter": ""
}}

Rules:

- tailored_summary is a 2-3 sentence professional summary rewritten for this job.
- tailored_experience should cover the same roles as the original resume, with
  bullets rewritten to emphasize relevant achievements and keywords from the job description.
- highlighted_skills should be the candidate's existing skills most relevant to this job,
  ordered by relevance.
- ats_keywords_used should list important job-description keywords that were
  naturally worked into the tailored content.
- cover_letter should be a concise, professional cover letter (3-4 short paragraphs)
  referencing the candidate's real background from the resume.

Do not include Markdown.
Do not include ```json.
Return only the JSON object.
"""

    # ---------------------------------------------------------
    # 3. Ask the LLM to generate the tailored content
    # ---------------------------------------------------------
    try:
        llm_response = call_llm(
            prompt,
            provider="gemini"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM tailoring failed: {str(e)}"
        )

    # ---------------------------------------------------------
    # 4. Convert the LLM response into Python data
    # ---------------------------------------------------------
    try:
        result = json.loads(llm_response)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="LLM returned an invalid JSON response."
        )

    # ---------------------------------------------------------
    # 5. Basic validation of the result
    # ---------------------------------------------------------
    required_fields = [
        "tailored_summary",
        "tailored_experience",
        "highlighted_skills",
        "ats_keywords_used",
        "cover_letter",
    ]

    missing_fields = [
        field for field in required_fields
        if field not in result
    ]

    if missing_fields:
        raise HTTPException(
            status_code=500,
            detail=f"LLM response is missing fields: {missing_fields}"
        )

    # ---------------------------------------------------------
    # 6. Return the final result
    # ---------------------------------------------------------
    return {
        "resume_id": resume["id"],
        "user_id": resume["user_id"],
        "tailored_summary": result["tailored_summary"],
        "tailored_experience": result["tailored_experience"],
        "highlighted_skills": result["highlighted_skills"],
        "ats_keywords_used": result["ats_keywords_used"],
        "cover_letter": result["cover_letter"],
    }