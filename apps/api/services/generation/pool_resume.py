import logging
import time
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from models import CandidateProfile, GenerationRun, EvidenceItem
from services.ai_client import structured_generation
from prompts.generation import POOL_RESUME_SYSTEM, RESUME_SCHEMA
from config import settings
from ._profile_context import build_full_profile_context, build_smart_evidence_context

logger = logging.getLogger(__name__)


async def generate_pool_resume(
    profile_id: str,
    options: dict,
    feedback_context: str,
    session: Session,
) -> GenerationRun:
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    all_evidence = session.exec(
        select(EvidenceItem)
        .where(EvidenceItem.profile_id == profile_id)
        .order_by(EvidenceItem.trust_level.desc())
        .limit(20)
    ).all()
    evidence_ids = [e.id for e in all_evidence]

    evidence_context = build_smart_evidence_context(all_evidence)
    profile_blocks = build_full_profile_context(profile_id, session)
    language = options.get("language_override", "de")

    system_prompt = POOL_RESUME_SYSTEM.format(
        user_preferences=feedback_context or ""
    )

    photo_note = ""
    if profile.photo_path:
        photo_note = "\nNote: This candidate has a profile photo. Set candidate_photo = true in output metadata."

    user_prompt = (
        f"Create a comprehensive master CV (Pool-CV) for this candidate — include ALL experience, skills, and achievements. "
        f"Use these blocks DIRECTLY. Do not omit any entry. Generate one section per block type.\n\n"
        f"## Candidate Profile\n{_profile_summary(profile)}{photo_note}\n\n"
        f"## Structured Profile Data\n{profile_blocks}\n\n"
        f"## Evidence Items\n{evidence_context}\n\n"
        f"Language: {language}"
    )

    logger.info(
        "Generation start: profile=%s run_type=resume_pool evidence_count=%d",
        profile_id, len(evidence_ids),
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
        "Generation done in %.1fs: run_type=resume_pool sections=%d items=%d",
        duration, len(sections), sum(len(s.get("items", [])) for s in sections),
    )

    if profile.photo_path:
        result["candidate_photo"] = True

    run = GenerationRun(
        profile_id=profile_id,
        job_description_id=None,
        application_id=None,
        run_type="resume_pool",
        selected_evidence_ids=evidence_ids,
        generation_inputs={"profile_id": profile_id, "options": options},
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
    if profile.phone:
        lines.append(f"Phone: {profile.phone}")
    if profile.location:
        lines.append(f"Location: {profile.location}")
    if profile.linkedin_url:
        lines.append(f"LinkedIn: {profile.linkedin_url}")
    if profile.github_url:
        lines.append(f"GitHub: {profile.github_url}")
    if profile.target_roles:
        lines.append(f"Target roles: {', '.join(str(r) for r in profile.target_roles)}")
    return "\n".join(lines)
