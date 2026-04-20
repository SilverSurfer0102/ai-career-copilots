import json
import logging
from datetime import datetime
from sqlmodel import Session

from models import GenerationRun, JobDescription
from services.ai_client import structured_generation
from prompts.generation import COMPACT_SYSTEM, COMPACT_SCHEMA
from config import settings

logger = logging.getLogger(__name__)


async def compact_resume(source_run: GenerationRun, session: Session) -> GenerationRun:
    job = session.get(JobDescription, source_run.job_description_id)
    job_context = ""
    if job:
        job_context = (
            f"Target role: {job.title or 'Unknown'}\n"
            f"Company: {job.company or 'Unknown'}\n"
            f"Must-have skills: {', '.join(job.must_have_skills[:8])}\n"
        )

    user_prompt = (
        f"Compact the following resume to ONE page maximum.\n\n"
        f"## Job Context\n{job_context}\n\n"
        f"## Current Resume (full version)\n"
        f"{json.dumps(source_run.generation_outputs, ensure_ascii=False, indent=2)}"
    )

    result = await structured_generation(
        system=COMPACT_SYSTEM,
        user=user_prompt,
        schema_description=COMPACT_SCHEMA,
        max_tokens=4096,
    )

    dropped_items = result.pop("dropped_items", [])

    compact_run = GenerationRun(
        profile_id=source_run.profile_id,
        job_description_id=source_run.job_description_id,
        application_id=source_run.application_id,
        run_type="resume_compact",
        status="completed",
        selected_evidence_ids=source_run.selected_evidence_ids,
        generation_inputs={
            "source_run_id": source_run.id,
            "compact_mode": True,
        },
        generation_outputs=result,
        intermediate_repr={"dropped_items": dropped_items},
        model_name=settings.anthropic_model,
        prompt_version="1.0",
        completed_at=datetime.utcnow(),
    )
    session.add(compact_run)
    session.commit()
    session.refresh(compact_run)
    logger.info("Compact run created: %s (dropped %d items)", compact_run.id, len(dropped_items))
    return compact_run
