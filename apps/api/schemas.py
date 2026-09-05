"""
Pydantic schemas for the Resume Ingestion pipeline & Authentication
"""

from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, EmailStr


# ---------------------------------------------------------------------------
# Authentication Schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Structured resume content (what Gemini extracts)
# ---------------------------------------------------------------------------

class ContactInfo(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None


class ExperienceEntry(BaseModel):
    title: str
    company: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    is_current: bool = False


class EducationEntry(BaseModel):
    institution: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None


class SkillEntry(BaseModel):
    name: str
    category: Literal["technical", "soft", "tool", "language", "certification", "other"] = "other"
    proficiency: Optional[Literal["beginner", "intermediate", "advanced", "expert"]] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class ResumeData(BaseModel):
    contact: ContactInfo
    summary: Optional[str] = None
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[SkillEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)

    class Config:
        extra = "ignore"


# ---------------------------------------------------------------------------
# Supabase row payloads
# ---------------------------------------------------------------------------

class ResumeRow(BaseModel):
    """Matches the actual Supabase `resumes` table columns:
    id (auto), user_id, file_path, parsed_data, created_at (auto)."""
    user_id: str
    file_path: str
    parsed_data: dict


class SkillRow(BaseModel):
    """Matches the actual Supabase `skills` table columns:
    id (auto), user_id, skill_name, category, created_at (auto).
    Note: this table has no resume_id, proficiency, or source column —
    skills are tracked per-user, not per-resume."""
    user_id: str
    skill_name: str
    category: str


# ---------------------------------------------------------------------------
# LangGraph shared state
# ---------------------------------------------------------------------------

class ResumePipelineState(BaseModel):
    # inputs
    file_path: str
    user_id: str
    job_description: Optional[str] = None

    # Parse Node output
    raw_text: Optional[str] = None
    parse_method: Optional[Literal["pymupdf", "pdfplumber"]] = None
    parse_error: Optional[str] = None

    # Validate Node output
    parsed_resume: Optional[ResumeData] = None
    validation_error: Optional[str] = None
    validation_attempts: int = 0

    # Enrich & Store Node output
    resume_id: Optional[str] = None
    stored: bool = False
    store_error: Optional[str] = None

    # Analyze JD Node output
    jd_analysis: Optional[dict] = None

    class Config:
        arbitrary_types_allowed = True

class JobDescriptionRequest(BaseModel):
    raw_text: str

class ResumeJdAnalysisRow(BaseModel):
    user_id: str
    resume_id: str
    jd_id: str
    analysis_json: dict


# ---------------------------------------------------------------------------
# ATS Tailoring Schemas
# ---------------------------------------------------------------------------

class TailorRequest(BaseModel):
    resume_id: str
    user_id: str
    job_description: str


class TailoredExperienceEntry(BaseModel):
    original_title: str
    company: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    rewritten_bullets: list[str] = Field(default_factory=list)


class TailoredResumeContent(BaseModel):
    rewritten_summary: str
    experience: list[TailoredExperienceEntry] = Field(default_factory=list)
    skills_to_emphasize: list[str] = Field(default_factory=list)
    keywords_added: list[str] = Field(default_factory=list)
    ats_match_estimate: Optional[int] = None


# ---------------------------------------------------------------------------
# Mock Interview Schemas
# ---------------------------------------------------------------------------

class InterviewStartRequest(BaseModel):
    user_id: str
    resume_id: Optional[str] = None
    job_description: str
    target_role: Optional[str] = None
    total_questions: int = 5


class InterviewMessageRequest(BaseModel):
    session_id: str
    user_id: str
    user_message: str


class InterviewEndRequest(BaseModel):
    session_id: str
    user_id: str


class ChatTurn(BaseModel):
    role: Literal["assistant", "user"]
    content: str
    timestamp: Optional[str] = None
    question_type: Optional[Literal["technical", "behavioral", "intro", "followup"]] = None


class InterviewScorecard(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    technical_knowledge: int = Field(ge=0, le=100)
    communication: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    problem_solving: int = Field(ge=0, le=100)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    per_question_feedback: list[dict] = Field(default_factory=list)
    recommendation: str = ""