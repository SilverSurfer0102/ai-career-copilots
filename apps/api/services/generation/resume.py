import logging
import time
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from models import CandidateProfile, JobDescription, GenerationRun, EvidenceItem
from schemas.generation import GenerationRequest
from services.ai_client import structured_generation
from services.retrieval import build_evidence_pack
from prompts.generation import RESUME_SYSTEM, RESUME_SCHEMA
from config import settings
from ._profile_context import build_full_profile_context, build_smart_evidence_context

logger = logging.getLogger(__name__)


async def generate_resume(
    payload: GenerationRequest,
    session: Session,
    feedback_context: str = "",
) -> GenerationRun:
    profile = session.get(CandidateProfile, payload.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    job = session.get(JobDescription, payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if payload.selected_evidence_ids:
        evidence_ids = payload.selected_evidence_ids
        evidence_items = session.exec(
            select(EvidenceItem).where(
                EvidenceItem.profile_id == payload.profile_id,
                EvidenceItem.id.in_(evidence_ids),
            )
        ).all()
    else:
        pack = await build_evidence_pack(
            profile_id=payload.profile_id,
            job=job,
            top_k=20,
            overrides={},
            session=session,
        )
        evidence_ids = list({eid for e in pack.entries for eid in e.evidence_ids})
        evidence_items = session.exec(
            select(EvidenceItem).where(
                EvidenceItem.profile_id == payload.profile_id,
                EvidenceItem.id.in_(evidence_ids),
            )
        ).all()

    evidence_context = build_smart_evidence_context(evidence_items)
    profile_blocks = build_full_profile_context(payload.profile_id, session)

    user_prompt = (
        f"Generate a tailored resume for the following candidate applying to this role.\n"
        f"Use these structured blocks DIRECTLY — do not omit any entry. Generate one section per block type.\n\n"
        f"## Candidate Profile\n{_profile_summary(profile)}\n\n"
        f"## Structured Profile Data\n{profile_blocks}\n\n"
        f"## Job Description\nTitle: {job.title}\nCompany: {job.company}\n"
        f"Must-have skills: {', '.join(job.must_have_skills)}\n"
        f"Responsibilities: {chr(10).join(job.responsibilities[:10])}\n\n"
        f"## Evidence for Experience Bullets\n{evidence_context}\n\n"
        f"Language: {payload.options.get('language_override') or job.output_language or 'en'}"
    )

    system_prompt = RESUME_SYSTEM.format(user_preferences=feedback_context or "")

    logger.info(
        "Generation start: profile=%s job=%s run_type=resume evidence_count=%d",
        payload.profile_id, payload.job_id, len(evidence_ids),
    )
    t0 = time.perf_counter()

    result = await structured_generation(
        system=system_prompt,
        user=user_prompt,
        schema_description=RESUME_SCHEMA,
        max_tokens=16384,
    )

    duration = time.perf_counter() - t0
    sections = result.get("sections", [])
    logger.info(
        "Generation done in %.1fs: run_type=resume sections=%d items=%d",
        duration, len(sections), sum(len(s.get("items", [])) for s in sections),
    )

    run = GenerationRun(
        profile_id=payload.profile_id,
        job_description_id=payload.job_id,
        application_id=payload.application_id,
        run_type="resume",
        selected_evidence_ids=evidence_ids,
        generation_inputs={
            "profile_id": payload.profile_id,
            "job_id": payload.job_id,
            "options": payload.options,
        },
        generation_outputs=result,
        intermediate_repr=result,
        model_name=settings.anthropic_model,
        prompt_version="1.1",
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
