import json
import re
from fastapi import HTTPException
from database import supabase
from llm_client import call_llm
from schemas import ResumeJdAnalysisRow


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


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


def calculate_job_match(
    user_id: str,
    job_description: str,
    resume_data: dict | None = None,
    resume_id: str | None = None,
) -> dict:
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
    # 1. Get the user's latest resume when one was not supplied
    # ---------------------------------------------------------
    resume = None
    if resume_data is None:
        resume = get_latest_resume(user_id)
        resume_data = resume.get("parsed_data")
        resume_id = resume["id"]

    parsed_data = resume_data

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
        llm_response = call_llm(prompt, provider="auto")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM matching failed: {str(e)}"
        )

    # ---------------------------------------------------------
    # 4. Convert the LLM response into Python data
    # ---------------------------------------------------------
    cleaned = _strip_json_fences(llm_response)
    try:
        result = json.loads(cleaned)
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

    missing_fields = [field for field in required_fields if field not in result]

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
    # 6. Add tailored suggestions before returning
    # ---------------------------------------------------------
    tailored_suggestions = generate_tailored_suggestions(parsed_data, job_description)
    result.update(tailored_suggestions)

    return {
        "user_id": user_id,
        "resume_id": resume_id,
        "match_score": score,
        "matching_skills": result["matching_skills"],
        "missing_skills": result["missing_skills"],
        "strengths": result["strengths"],
        "gaps": result["gaps"],
        "recommendation": result["recommendation"],
        "tailored_suggestions": tailored_suggestions
    }


def analyze_resume_jd(resume_id: str, jd_id: str, user_id: str) -> dict:
    """
    Fetch a stored resume + a stored JD, run the match analysis,
    persist the analysis row, and return the analysis dict.
    """
    resume = (
        supabase.table("resumes")
        .select("*")
        .eq("id", resume_id)
        .single()
        .execute()
    )
    jd = (
        supabase.table("job_descriptions")
        .select("*")
        .eq("id", jd_id)
        .single()
        .execute()
    )

    analysis_result = calculate_job_match(
        user_id=user_id,
        job_description=jd.data["raw_text"],
        resume_data=resume.data["parsed_data"],
        resume_id=resume_id,
    )

    analysis_row = ResumeJdAnalysisRow(
        user_id=user_id,
        resume_id=resume_id,
        jd_id=jd_id,
        analysis_json=analysis_result,
    )

    supabase.table("resume_jd_analysis").insert(
        analysis_row.model_dump()
    ).execute()

    return analysis_result


# ---------------------------------------------------------------------------
# Helper: Generate Tailored Suggestions
# ---------------------------------------------------------------------------

def generate_tailored_suggestions(resume_data: dict, job_description: str) -> dict:
    prompt = f"""
Create tailored suggestions for improving this resume based on the job description.

Resume: {json.dumps(resume_data, indent=2)}
Job Description: {job_description}

Return JSON with these fields:
{{
    "tailored_summary": str,
    "skills_to_add": list[str],
    "experience_to_enhance": list[str],
    "projects_to_include": list[str],
    "cover_letter_outline": str
}}
"""
    try:
        response = call_llm(prompt, provider="auto")
        return json.loads(_strip_json_fences(response))
    except Exception as e:
        return {
            "error": str(e),
            "tailored_summary": "Unable to generate tailored suggestions",
            "skills_to_add": [],
            "experience_to_enhance": [],
            "projects_to_include": [],
            "cover_letter_outline": ""
        }
