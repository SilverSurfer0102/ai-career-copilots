import uuid
from datetime import datetime
from typing import Optional, Any
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class CandidateProfile(SQLModel, table=True):
    __tablename__ = "candidate_profile"

    id: str = Field(default_factory=_uuid, primary_key=True)
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    photo_path: Optional[str] = None
    target_roles: list = Field(default_factory=list, sa_column=Column(JSON))
    summary_variants: list = Field(default_factory=list, sa_column=Column(JSON))
    preferences: dict = Field(default_factory=dict, sa_column=Column(JSON))
    default_languages: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class EvidenceItem(SQLModel, table=True):
    __tablename__ = "evidence_item"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    source_type: str
    source_name: str
    raw_text: str
    normalized_text: Optional[str] = None
    file_path: Optional[str] = None
    trust_level: float = 1.0
    tags: list = Field(default_factory=list, sa_column=Column(JSON))
    entity_links: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)


class Experience(SQLModel, table=True):
    __tablename__ = "experience"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    employer: Optional[str] = None
    role_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    bullets: list = Field(default_factory=list, sa_column=Column(JSON))
    tech_stack: list = Field(default_factory=list, sa_column=Column(JSON))
    domain_tags: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Project(SQLModel, table=True):
    __tablename__ = "project"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    title: Optional[str] = None
    role: Optional[str] = None
    time_period: Optional[str] = None
    description: Optional[str] = None
    bullets: list = Field(default_factory=list, sa_column=Column(JSON))
    technologies: list = Field(default_factory=list, sa_column=Column(JSON))
    outcomes: list = Field(default_factory=list, sa_column=Column(JSON))
    links: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Skill(SQLModel, table=True):
    __tablename__ = "skill"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    name: str
    category: Optional[str] = None
    proficiency: Optional[str] = None
    years_of_experience: Optional[float] = None
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class LanguageSkill(SQLModel, table=True):
    __tablename__ = "language_skill"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    language: str
    level: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Education(SQLModel, table=True):
    __tablename__ = "education"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    grade: Optional[str] = None
    achievements: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Publication(SQLModel, table=True):
    __tablename__ = "publication"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    title: Optional[str] = None
    pub_type: Optional[str] = None
    venue: Optional[str] = None
    published_date: Optional[str] = None
    coauthors: list = Field(default_factory=list, sa_column=Column(JSON))
    abstract: Optional[str] = None
    keywords: list = Field(default_factory=list, sa_column=Column(JSON))
    links: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Certification(SQLModel, table=True):
    __tablename__ = "certification"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    name: Optional[str] = None
    issuer: Optional[str] = None
    issued_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Achievement(SQLModel, table=True):
    __tablename__ = "achievement"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    evidence_refs: list = Field(default_factory=list, sa_column=Column(JSON))
    statement: Optional[str] = None
    context: Optional[str] = None
    metric_type: Optional[str] = None
    metric_value: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class ContentBlock(SQLModel, table=True):
    """A user-authored, pre-approved text block (bullet, summary, letter fragment).

    The generation pipeline only ever *selects* among approved blocks — it never
    writes this text itself. This is what keeps generated documents grounded and
    in the candidate's own voice instead of freshly written LLM prose.
    """

    __tablename__ = "content_block"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id", index=True)
    parent_type: str  # "experience" | "project" | "education" | "standalone"
    parent_id: Optional[str] = None
    kind: str  # "bullet" | "summary" | "letter_intro" | "letter_close"
    text: str
    variant_label: Optional[str] = None  # e.g. "kurz" | "lang" | "technisch"
    role_tags: list = Field(default_factory=list, sa_column=Column(JSON))
    keywords: list = Field(default_factory=list, sa_column=Column(JSON))
    language: str = "de"
    priority: int = 0
    approved: bool = False
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class JobDescription(SQLModel, table=True):
    __tablename__ = "job_description"

    id: str = Field(default_factory=_uuid, primary_key=True)
    raw_text: str
    title: Optional[str] = None
    company: Optional[str] = None
    seniority: Optional[str] = None
    location: Optional[str] = None
    remote_hint: Optional[str] = None
    output_language: str = "en"
    must_have_skills: list = Field(default_factory=list, sa_column=Column(JSON))
    nice_to_have_skills: list = Field(default_factory=list, sa_column=Column(JSON))
    responsibilities: list = Field(default_factory=list, sa_column=Column(JSON))
    domain_terms: list = Field(default_factory=list, sa_column=Column(JSON))
    education_requirements: list = Field(default_factory=list, sa_column=Column(JSON))
    language_requirements: list = Field(default_factory=list, sa_column=Column(JSON))
    soft_skills: list = Field(default_factory=list, sa_column=Column(JSON))
    keywords: list = Field(default_factory=list, sa_column=Column(JSON))
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class JobLead(SQLModel, table=True):
    """A candidate job posting sitting in the swipe queue, before it becomes a
    full JobDescription. Sourced from the Bundesagentur API or pasted manually
    (e.g. via the browser bookmarklet) — never scraped from LinkedIn/Stepstone,
    which would violate their terms of service."""

    __tablename__ = "job_lead"

    id: str = Field(default_factory=_uuid, primary_key=True)
    source: str  # "bundesagentur" | "paste"
    external_id: Optional[str] = None
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    raw_text: str = ""
    posted_at: Optional[str] = None
    starts_at: Optional[str] = None
    status: str = "new"  # "new" | "liked" | "passed" | "applied"
    score: Optional[float] = None
    dedupe_hash: str = Field(index=True)
    created_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class Application(SQLModel, table=True):
    __tablename__ = "application"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    job_id: str = Field(foreign_key="job_description.id")
    status: str = "draft"  # draft|ready|submitted|interview|rejected|offer|archived
    label: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    model_config = {"arbitrary_types_allowed": True}


class EditFeedback(SQLModel, table=True):
    __tablename__ = "edit_feedback"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id", index=True)
    run_id: str = Field(foreign_key="generation_run.id")
    run_type: str
    field_path: str
    field_context: str
    original_value: str
    edited_value: str
    created_at: datetime = Field(default_factory=_now)


class GenerationRun(SQLModel, table=True):
    __tablename__ = "generation_run"

    id: str = Field(default_factory=_uuid, primary_key=True)
    profile_id: str = Field(foreign_key="candidate_profile.id")
    job_description_id: Optional[str] = Field(default=None, foreign_key="job_description.id")
    application_id: Optional[str] = Field(default=None, foreign_key="application.id")
    run_type: str  # "resume" | "cover_letter" | "match_analysis" | "resume_compact" | "resume_pool"
    status: str = "pending"  # "pending" | "running" | "completed" | "failed"
    selected_evidence_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    generation_inputs: dict = Field(default_factory=dict, sa_column=Column(JSON))
    generation_outputs: dict = Field(default_factory=dict, sa_column=Column(JSON))
    intermediate_repr: dict = Field(default_factory=dict, sa_column=Column(JSON))
    validation_report: dict = Field(default_factory=dict, sa_column=Column(JSON))
    model_name: Optional[str] = None
    prompt_version: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)
    completed_at: Optional[datetime] = None
