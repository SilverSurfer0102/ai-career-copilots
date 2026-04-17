from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class JobAnalyzeRequest(BaseModel):
    raw_text: str


class JobCreate(BaseModel):
    raw_text: str
    title: Optional[str] = None
    company: Optional[str] = None
    seniority: Optional[str] = None
    location: Optional[str] = None
    remote_hint: Optional[str] = None
    output_language: str = "en"
    must_have_skills: list = []
    nice_to_have_skills: list = []
    responsibilities: list = []
    domain_terms: list = []
    education_requirements: list = []
    language_requirements: list = []
    soft_skills: list = []
    keywords: list = []
    notes: Optional[str] = None


class JobRead(BaseModel):
    id: str
    raw_text: str
    title: Optional[str] = None
    company: Optional[str] = None
    seniority: Optional[str] = None
    location: Optional[str] = None
    remote_hint: Optional[str] = None
    output_language: str
    must_have_skills: list
    nice_to_have_skills: list
    responsibilities: list
    domain_terms: list
    education_requirements: list
    language_requirements: list
    soft_skills: list
    keywords: list
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
