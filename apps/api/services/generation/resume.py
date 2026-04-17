import json
import logging
from datetime import datetime
from sqlmodel import Session, select

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

    user_prompt = (
        f"Generate a tailored resume for the following candidate applying to this role.\n\n"
        f"## Candidate Profile\n{_profile_summary(profile)}\n\n"
        f"## Job Description\nTitle: {job.title}\nCompany: {job.company}\n"
        f"Must-have skills: {', '.join(job.must_have_skills)}\n"
        f"Responsibilities: {chr(10).join(job.responsibilities[:10])}\n\n"
        f"## Selected Evidence\n{evidence_context}\n\n"
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
