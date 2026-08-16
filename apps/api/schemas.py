"""
Pydantic schemas for the Resume Ingestion pipeline:
Parse Node -> Validate Node -> Enrich & Store Node
"""

from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


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

    class Config:
        arbitrary_types_allowed = True