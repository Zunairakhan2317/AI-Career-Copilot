import json

from fastapi import HTTPException

from database import supabase
from llm_client import call_llm


def get_latest_resume(user_id: str) -> dict:
    """
    Fetch the user's most recently uploaded resume from Supabase.
    """

    response = (
        supabase.table("resumes")
        .select("id, user_id, parsed_data, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="No resume found for this user."
        )

    return response.data[0]


def calculate_job_match(user_id: str, job_description: str) -> dict:
    """
    Compare the user's latest resume with a job description
    using the existing LLM client.
    """

    if not job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Job description cannot be empty."
        )

    # ---------------------------------------------------------
    # 1. Get the user's latest resume
    # ---------------------------------------------------------
    resume = get_latest_resume(user_id)

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
You are an expert job-resume matching system.

Compare the candidate's resume against the job description.

Candidate Resume:
{json.dumps(parsed_data, indent=2)}

Job Description:
{job_description}

Analyze the candidate based only on the information provided.

Return ONLY valid JSON using exactly this structure:

{{
    "match_score": 0,
    "matching_skills": [],
    "missing_skills": [],
    "strengths": [],
    "gaps": [],
    "recommendation": ""
}}

Rules:

- match_score must be an integer from 0 to 100.
- matching_skills should contain skills present in both the resume and job requirements.
- missing_skills should contain important job requirements that are not demonstrated in the resume.
- strengths should contain concise reasons why the candidate matches.
- gaps should contain concise reasons why the candidate may not match.
- recommendation must be one of:
  "Strong Match",
  "Good Match",
  "Partial Match",
  "Weak Match".

Do not include Markdown.
Do not include ```json.
Return only the JSON object.
"""

    # ---------------------------------------------------------
    # 3. Ask the LLM to calculate the match
    # ---------------------------------------------------------
    try:
        llm_response = call_llm(
            prompt,
            provider="gemini"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM matching failed: {str(e)}"
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
        "match_score",
        "matching_skills",
        "missing_skills",
        "strengths",
        "gaps",
        "recommendation",
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

    score = result["match_score"]

    if not isinstance(score, int) or not 0 <= score <= 100:
        raise HTTPException(
            status_code=500,
            detail="LLM returned an invalid match score."
        )

    # ---------------------------------------------------------
    # 6. Return the final result
    # ---------------------------------------------------------
    return {
        "user_id": user_id,
        "resume_id": resume["id"],
        "match_score": score,
        "matching_skills": result["matching_skills"],
        "missing_skills": result["missing_skills"],
        "strengths": result["strengths"],
        "gaps": result["gaps"],
        "recommendation": result["recommendation"],
    }