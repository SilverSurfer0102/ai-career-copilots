from __future__ import annotations
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, field_validator


def _coerce_list(v: Any) -> Any:
    """Accept a bare string where a list is expected — wrap it."""
    if isinstance(v, str):
        return [v] if v.strip() else []
    return v


# ── Experience ───────────────────────────────────────────────────────────────

class ExperienceCreate(BaseModel):
    employer: Optional[str] = None
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    bullets: list = []
    tech_stack: list = []
    domain_tags: list = []

    _coerce_bullets = field_validator("bullets", "tech_stack", "domain_tags", mode="before")(_coerce_list)


class ExperienceUpdate(BaseModel):
    employer: Optional[str] = None
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    bullets: Optional[list] = None
    tech_stack: Optional[list] = None
    domain_tags: Optional[list] = None

    _coerce_bullets = field_validator("bullets", "tech_stack", "domain_tags", mode="before")(_coerce_list)


class ExperienceRead(BaseModel):
    id: str
    profile_id: str
    evidence_refs: list = []
    employer: Optional[str] = None
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    bullets: list = []
    tech_stack: list = []
    domain_tags: list = []
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Project ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: Optional[str] = None
    role: Optional[str] = None
    time_period: Optional[str] = None
    description: Optional[str] = None
    bullets: list = []
    technologies: list = []
    outcomes: list = []
    links: list = []

    _coerce_lists = field_validator("bullets", "technologies", "outcomes", "links", mode="before")(_coerce_list)


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    role: Optional[str] = None
    time_period: Optional[str] = None
    description: Optional[str] = None
    bullets: Optional[list] = None
    technologies: Optional[list] = None
    outcomes: Optional[list] = None
    links: Optional[list] = None

    _coerce_lists = field_validator("bullets", "technologies", "outcomes", "links", mode="before")(_coerce_list)


class ProjectRead(BaseModel):
    id: str
    profile_id: str
    evidence_refs: list = []
    title: Optional[str] = None
    role: Optional[str] = None
    time_period: Optional[str] = None
    description: Optional[str] = None
    bullets: list = []
    technologies: list = []
    outcomes: list = []
    links: list = []
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Skill ────────────────────────────────────────────────────────────────────

class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None
    proficiency: Optional[str] = None
    years_of_experience: Optional[float] = None


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    proficiency: Optional[str] = None
    years_of_experience: Optional[float] = None


class SkillRead(BaseModel):
    id: str
    profile_id: str
    name: str
    category: Optional[str] = None
    proficiency: Optional[str] = None
    years_of_experience: Optional[float] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Education ────────────────────────────────────────────────────────────────

class EducationCreate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    grade: Optional[str] = None
    achievements: list = []

    _coerce_achievements = field_validator("achievements", mode="before")(_coerce_list)


class EducationUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    grade: Optional[str] = None
    achievements: Optional[list] = None

    _coerce_achievements = field_validator("achievements", mode="before")(_coerce_list)


class EducationRead(BaseModel):
    id: str
    profile_id: str
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    grade: Optional[str] = None
    achievements: list = []
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Language ─────────────────────────────────────────────────────────────────

class LanguageCreate(BaseModel):
    language: str
    level: Optional[str] = None


class LanguageUpdate(BaseModel):
    language: Optional[str] = None
    level: Optional[str] = None


class LanguageRead(BaseModel):
    id: str
    profile_id: str
    language: str
    level: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Certification ─────────────────────────────────────────────────────────────

class CertificationCreate(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    issued_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None


class CertificationUpdate(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    issued_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None


class CertificationRead(BaseModel):
    id: str
    profile_id: str
    name: Optional[str] = None
    issuer: Optional[str] = None
    issued_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Achievement ───────────────────────────────────────────────────────────────

class AchievementCreate(BaseModel):
    statement: Optional[str] = None
    context: Optional[str] = None
    metric_type: Optional[str] = None
    metric_value: Optional[str] = None


class AchievementUpdate(BaseModel):
    statement: Optional[str] = None
    context: Optional[str] = None
    metric_type: Optional[str] = None
    metric_value: Optional[str] = None


class AchievementRead(BaseModel):
    id: str
    profile_id: str
    statement: Optional[str] = None
    context: Optional[str] = None
    metric_type: Optional[str] = None
    metric_value: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Content Block ────────────────────────────────────────────────────────────

class ContentBlockCreate(BaseModel):
    parent_type: str
    parent_id: Optional[str] = None
    kind: str
    text: str
    variant_label: Optional[str] = None
    role_tags: list = []
    keywords: list = []
    language: str = "de"
    priority: int = 0
    approved: bool = False

    _coerce_tags = field_validator("role_tags", "keywords", mode="before")(_coerce_list)


class ContentBlockUpdate(BaseModel):
    parent_type: Optional[str] = None
    parent_id: Optional[str] = None
    kind: Optional[str] = None
    text: Optional[str] = None
    variant_label: Optional[str] = None
    role_tags: Optional[list] = None
    keywords: Optional[list] = None
    language: Optional[str] = None
    priority: Optional[int] = None
    approved: Optional[bool] = None

    _coerce_tags = field_validator("role_tags", "keywords", mode="before")(_coerce_list)


class ContentBlockRead(BaseModel):
    id: str
    profile_id: str
    parent_type: str
    parent_id: Optional[str] = None
    kind: str
    text: str
    variant_label: Optional[str] = None
    role_tags: list = []
    keywords: list = []
    language: str = "de"
    priority: int = 0
    approved: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
