"""
services/ats_service.py 

Core ATS resume tailoring + cover letter generation logic.

Confirmed against the real apps/api/llm_client.py (2 days ago):
    call_llm(prompt: str, provider: str = "gemini", model: str = None) -> str
This routes to Gemini (gemini-3.5-flash) or Groq (llama-3.3-70b-versatile)
internally via the LLMClient singleton, and is the exact function used below.
"""

import json
from typing import Optional

from llm_client import call_llm


def _call_llm(prompt: str, provider: str = "gemini") -> str:
    """Thin wrapper so the rest of this file doesn't care which LLM backend is used."""
    return call_llm(prompt, provider=provider)


def tailor_resume_bullets(
    parsed_resume: dict,
    job_description: str,
    provider: str = "gemini",
) -> list[str]:
    """
    Generate ATS-optimized bullet points tailored to a specific job description.

    Args:
        parsed_resume: structured resume data (e.g. resumes.parsed_data from Supabase).
        job_description: the target job posting text.
        provider: "gemini" or "groq".

    Returns:
        List of tailored bullet point strings.
    """
    prompt = f"""You are an expert ATS resume writer. Given the candidate's parsed
resume data and a target job description, rewrite the candidate's experience into
concise, keyword-optimized bullet points that will score well against Applicant
Tracking Systems for this specific role.

Rules:
- Use strong action verbs and quantify impact where the data allows.
- Naturally include keywords/skills from the job description that genuinely match
  the candidate's background. Do NOT fabricate experience the candidate doesn't have.
- Return ONLY valid JSON in this exact shape, no extra commentary:
  {{"bullets": ["...", "...", "..."]}}

Candidate resume data:
{json.dumps(parsed_resume, indent=2)}

Target job description:
{job_description}
"""
    raw = _call_llm(prompt, provider=provider)
    cleaned = raw.strip()
    for fence in ("```json", "```"):
        if cleaned.startswith(fence):
            cleaned = cleaned[len(fence):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        return data.get("bullets", [])
    except json.JSONDecodeError:
        # Fallback: model didn't return clean JSON — split into lines instead
        # of hard-failing the whole request.
        return [
            line.strip("-• ").strip()
            for line in cleaned.splitlines()
            if line.strip()
        ]


def generate_cover_letter(
    parsed_resume: dict,
    job_description: str,
    company_name: Optional[str] = None,
    provider: str = "gemini",
) -> str:
    """
    Generate a tailored cover letter for the candidate + job description.

    Returns:
        Plain-text cover letter, ready to display or download.
    """
    company_line = f" at {company_name}" if company_name else ""
    prompt = f"""Write a concise, professional cover letter (3-4 short paragraphs)
for a candidate applying{company_line}, based on their resume and the job
description below. Tone: confident and specific, no generic filler. Do not invent
facts that aren't present in the resume. Return plain text only — no markdown,
no headers, no placeholders like [Company Name] left unfilled if the name is given.

Candidate resume data:
{json.dumps(parsed_resume, indent=2)}

Job description:
{job_description}
"""
    return _call_llm(prompt, provider=provider).strip()


def tailor_resume(
    parsed_resume: dict,
    job_description: str,
    company_name: Optional[str] = None,
    provider: str = "gemini",
) -> dict:
    """
    Convenience wrapper used by routers/resume.py's POST /api/resume/tailor.
    Runs bullet tailoring + cover letter generation together.
    """
    return {
        "tailored_bullets": tailor_resume_bullets(parsed_resume, job_description, provider),
        "cover_letter": generate_cover_letter(parsed_resume, job_description, company_name, provider),
    }
