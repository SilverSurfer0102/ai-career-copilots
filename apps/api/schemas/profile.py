from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models import (
    CandidateProfile, Experience, Project, Skill, LanguageSkill,
    Education, Publication, Certification, Achievement, EvidenceItem,
)


class ProfileCreate(BaseModel):
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    target_roles: list = []
    summary_variants: list = []
    preferences: dict = {}
    default_languages: list = []


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    target_roles: Optional[list] = None
    summary_variants: Optional[list] = None
    preferences: Optional[dict] = None
    default_languages: Optional[list] = None


class ProfileRead(BaseModel):
    id: str
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    target_roles: list = []
    summary_variants: list = []
    preferences: dict = {}
    default_languages: list = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileBlocksRead(BaseModel):
    profile: ProfileRead
    experiences: list[Experience] = []
    projects: list[Project] = []
    skills: list[Skill] = []
    languages: list[LanguageSkill] = []
    educations: list[Education] = []
    publications: list[Publication] = []
    certifications: list[Certification] = []
    achievements: list[Achievement] = []
    evidence_items: list[EvidenceItem] = []

    model_config = {"from_attributes": True}
