import json
import logging
from datetime import datetime
from sqlmodel import Session, select

from collections import defaultdict

from models import (
    CandidateProfile, JobDescription, GenerationRun,
    Experience, Project, Skill, LanguageSkill, Education,
    Publication, Certification, Achievement, EvidenceItem,
)
from schemas.generation import GenerationRequest
from services.ai_client import structured_generation
from services.retrieval import build_evidence_pack
from prompts.generation import RESUME_SYSTEM, RESUME_SCHEMA
from config import settings

logger = logging.getLogger(__name__)


async def generate_resume(payload: GenerationRequest, session: Session) -> GenerationRun:
    profile = session.get(CandidateProfile, payload.profile_id)
    job = session.get(JobDescription, payload.job_id)
    assert profile and job

    if payload.selected_evidence_ids:
        evidence_ids = payload.selected_evidence_ids
    else:
        pack = await build_evidence_pack(
            profile_id=payload.profile_id,
            job=job,
            top_k=20,
            overrides={},
            session=session,
        )
        evidence_ids = list({eid for e in pack.entries for eid in e.evidence_ids})

    evidence_context = _build_evidence_context(
        profile_id=payload.profile_id,
        evidence_ids=evidence_ids,
        pack_entries=None,
        session=session,
    )

    profile_blocks = _build_profile_blocks(payload.profile_id, session)

    user_prompt = (
        f"Generate a tailored resume for the following candidate applying to this role.\n\n"
        f"## Candidate Profile\n{_profile_summary(profile)}\n\n"
        f"## Structured Profile Data (use these blocks DIRECTLY — do not omit any)\n{profile_blocks}\n\n"
        f"## Job Description\nTitle: {job.title}\nCompany: {job.company}\n"
        f"Must-have skills: {', '.join(job.must_have_skills)}\n"
        f"Responsibilities: {chr(10).join(job.responsibilities[:10])}\n\n"
        f"## Evidence for Experience Bullets\n{evidence_context}\n\n"
        f"Language: {payload.options.get('language_override') or job.output_language or 'en'}"
    )

    result = await structured_generation(
        system=RESUME_SYSTEM,
        user=user_prompt,
        schema_description=RESUME_SCHEMA,
        max_tokens=8192,
    )

    run = GenerationRun(
        profile_id=payload.profile_id,
        job_description_id=payload.job_id,
        application_id=payload.application_id,
        run_type="resume",
        selected_evidence_ids=evidence_ids,
        generation_inputs={"profile_id": payload.profile_id, "job_id": payload.job_id, "options": payload.options},
        generation_outputs=result,
        intermediate_repr=result,
        model_name=settings.anthropic_model,
        prompt_version="1.0",
        status="completed",
        completed_at=datetime.utcnow(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _profile_summary(profile: CandidateProfile) -> str:
    lines = [f"Name: {profile.display_name}"]
    if profile.email:
        lines.append(f"Email: {profile.email}")
    if profile.location:
        lines.append(f"Location: {profile.location}")
    if profile.target_roles:
        lines.append(f"Target roles: {', '.join(str(r) for r in profile.target_roles)}")
    return "\n".join(lines)


def _build_profile_blocks(profile_id: str, session: Session) -> str:
    """Return all structured profile blocks as a formatted string for the prompt.

    These are authoritative — Claude must include them in full, not filter by relevance.
    """
    blocks = []

    languages = session.exec(
        select(LanguageSkill).where(LanguageSkill.profile_id == profile_id)
    ).all()
    if languages:
        lang_lines = [f"  - {l.language}" + (f" ({l.level})" if l.level else "") for l in languages]
        blocks.append("LANGUAGES (include ALL in Languages section):\n" + "\n".join(lang_lines))

    skills = session.exec(
        select(Skill).where(Skill.profile_id == profile_id)
    ).all()
    if skills:
        by_cat: dict = defaultdict(list)
        for s in skills:
            by_cat[s.category or "Other"].append(s.name)
        skill_lines = [f"  {cat}: {', '.join(names)}" for cat, names in by_cat.items()]
        blocks.append("SKILLS (include ALL in Skills section):\n" + "\n".join(skill_lines))

    certs = session.exec(
        select(Certification).where(Certification.profile_id == profile_id)
    ).all()
    if certs:
        cert_lines = [
            f"  - {c.name}" + (f" ({c.issuer}, {c.issued_date})" if c.issuer else "")
            for c in certs if c.name
        ]
        if cert_lines:
            blocks.append("CERTIFICATIONS (include ALL in Certifications section):\n" + "\n".join(cert_lines))

    return "\n\n".join(blocks) if blocks else "No structured blocks available."


def _build_evidence_context(
    profile_id: str,
    evidence_ids: list[str],
    pack_entries,
    session: Session,
) -> str:
    if not evidence_ids:
        return "No specific evidence selected — use full profile context."

    items = session.exec(
        select(EvidenceItem).where(
            EvidenceItem.profile_id == profile_id,
            EvidenceItem.id.in_(evidence_ids),
        )
    ).all()

    blocks = []
    for item in items:
        blocks.append(
            f"[evidence_id: {item.id}]\n"
            f"Source: {item.source_name} ({item.source_type})\n"
            f"Text: {(item.normalized_text or item.raw_text)[:1000]}"
        )
    return "\n\n---\n\n".join(blocks)
