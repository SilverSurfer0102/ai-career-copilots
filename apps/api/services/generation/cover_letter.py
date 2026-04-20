from datetime import datetime
from sqlmodel import Session, select

from models import CandidateProfile, JobDescription, GenerationRun, EvidenceItem
from schemas.generation import GenerationRequest
from services.ai_client import structured_generation
from services.retrieval import build_evidence_pack
from prompts.generation import COVER_LETTER_SYSTEM, COVER_LETTER_SCHEMA
from config import settings


async def generate_cover_letter(payload: GenerationRequest, session: Session) -> GenerationRun:
    profile = session.get(CandidateProfile, payload.profile_id)
    job = session.get(JobDescription, payload.job_id)
    assert profile and job

    if payload.selected_evidence_ids:
        evidence_ids = payload.selected_evidence_ids
    else:
        pack = await build_evidence_pack(
            profile_id=payload.profile_id,
            job=job,
            top_k=15,
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

    evidence_context = "\n\n---\n\n".join(
        f"[evidence_id: {item.id}]\n{(item.normalized_text or item.raw_text)[:800]}"
        for item in evidence_items
    )

    user_prompt = (
        f"Write a professional cover letter for {profile.display_name} applying to "
        f"{job.title} at {job.company}.\n\n"
        f"Candidate location: {profile.location or 'not specified'}\n"
        f"Target role: {job.title}\n"
        f"Key requirements: {', '.join(job.must_have_skills[:8])}\n"
        f"Language: {payload.options.get('language_override') or job.output_language or 'en'}\n\n"
        f"## Selected Evidence\n{evidence_context}"
    )

    result = await structured_generation(
        system=COVER_LETTER_SYSTEM,
        user=user_prompt,
        schema_description=COVER_LETTER_SCHEMA,
        max_tokens=4096,
    )

    run = GenerationRun(
        profile_id=payload.profile_id,
        job_description_id=payload.job_id,
        application_id=payload.application_id,
        run_type="cover_letter",
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
