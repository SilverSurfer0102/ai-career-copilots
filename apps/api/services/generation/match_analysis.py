from datetime import datetime
from sqlmodel import Session, select

from models import CandidateProfile, JobDescription, GenerationRun, EvidenceItem, Skill
from schemas.generation import GenerationRequest
from services.ai_client import structured_generation
from prompts.generation import MATCH_ANALYSIS_SYSTEM, MATCH_ANALYSIS_SCHEMA
from config import settings


async def generate_match_analysis(payload: GenerationRequest, session: Session) -> GenerationRun:
    profile = session.get(CandidateProfile, payload.profile_id)
    job = session.get(JobDescription, payload.job_id)
    assert profile and job

    skills = session.exec(select(Skill).where(Skill.profile_id == payload.profile_id)).all()
    skill_names = [s.name for s in skills]

    evidence_summary = ""
    if payload.selected_evidence_ids:
        items = session.exec(
            select(EvidenceItem).where(
                EvidenceItem.profile_id == payload.profile_id,
                EvidenceItem.id.in_(payload.selected_evidence_ids),
            )
        ).all()
        evidence_summary = "\n\n".join(
            f"[evidence_id: {item.id}]\n{(item.normalized_text or item.raw_text)[:600]}"
            for item in items
        )

    user_prompt = (
        f"Analyze the fit between this candidate and job.\n\n"
        f"## Candidate\nName: {profile.display_name}\n"
        f"Skills: {', '.join(skill_names)}\n"
        f"Target roles: {', '.join(str(r) for r in (profile.target_roles or []))}\n\n"
        f"## Job\nTitle: {job.title} at {job.company}\n"
        f"Seniority: {job.seniority or 'not specified'}\n"
        f"Must-have skills: {', '.join(job.must_have_skills)}\n"
        f"Nice-to-have: {', '.join(job.nice_to_have_skills)}\n"
        f"Responsibilities: {chr(10).join(job.responsibilities[:8])}\n\n"
        f"Language: {payload.options.get('language_override') or job.output_language or 'en'}\n\n"
        f"## Evidence\n{evidence_summary or 'No specific evidence selected.'}"
    )

    result = await structured_generation(
        system=MATCH_ANALYSIS_SYSTEM,
        user=user_prompt,
        schema_description=MATCH_ANALYSIS_SCHEMA,
        max_tokens=4096,
    )

    run = GenerationRun(
        profile_id=payload.profile_id,
        job_description_id=payload.job_id,
        application_id=payload.application_id,
        run_type="match_analysis",
        selected_evidence_ids=payload.selected_evidence_ids,
        generation_inputs={"profile_id": payload.profile_id, "job_id": payload.job_id},
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
