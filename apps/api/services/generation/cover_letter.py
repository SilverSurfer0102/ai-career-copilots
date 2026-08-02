import logging
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from models import CandidateProfile, JobDescription, GenerationRun, ContentBlock
from schemas.generation import GenerationRequest
from services.ai_client import structured_generation
from prompts.generation import LETTER_SELECTION_SYSTEM, LETTER_SELECTION_SCHEMA
from config import settings
from ._selection_context import collect_letter_fragments

logger = logging.getLogger(__name__)

_CLOSING_SALUTATION = {"de": "Mit freundlichen Grüßen", "en": "Sincerely"}
_OPENING_SALUTATION = {"de": "Sehr geehrte Damen und Herren,", "en": "Dear Hiring Manager,"}
_OPENING_SALUTATION_NAMED = {"de": "Sehr geehrte(r) {name},", "en": "Dear {name},"}
_FALLBACK_INTRO = {
    "de": "mit großem Interesse bewerbe ich mich auf die Position {role} bei {company}.",
    "en": "I am writing to apply for the {role} position at {company}.",
}
_FALLBACK_CLOSE = {
    "de": "Über die Möglichkeit eines persönlichen Gesprächs würde ich mich sehr freuen.",
    "en": "I would welcome the opportunity to discuss my application in person.",
}


async def generate_cover_letter(payload: GenerationRequest, session: Session) -> GenerationRun:
    profile = session.get(CandidateProfile, payload.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    job = session.get(JobDescription, payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    lang = payload.options.get("language_override") or job.output_language or "de"

    intro_candidates = collect_letter_fragments(payload.profile_id, session, "letter_intro")
    close_candidates = collect_letter_fragments(payload.profile_id, session, "letter_close")
    achievement_candidates = session.exec(
        select(ContentBlock).where(
            ContentBlock.profile_id == payload.profile_id,
            ContentBlock.kind == "bullet",
            ContentBlock.approved == True,  # noqa: E712
        )
    ).all()

    def _fmt(blocks: list[ContentBlock]) -> str:
        return "\n".join(f"  - [{b.id}] {b.text[:200]}" for b in blocks) or "  (none available)"

    user_prompt = (
        f"Write the motivation hook for a cover letter.\n\n"
        f"## Job\nTitle: {job.title}\nCompany: {job.company}\n"
        f"Must-have skills: {', '.join(job.must_have_skills or [])}\n"
        f"Responsibilities: {chr(10).join((job.responsibilities or [])[:8])}\n\n"
        f"## Intro candidates\n{_fmt(intro_candidates)}\n\n"
        f"## Achievement candidates\n{_fmt(achievement_candidates)}\n\n"
        f"## Closing candidates\n{_fmt(close_candidates)}\n\n"
        f"Language: {lang}"
    )

    selection = await structured_generation(
        system=LETTER_SELECTION_SYSTEM,
        user=user_prompt,
        schema_description=LETTER_SELECTION_SCHEMA,
        max_tokens=1024,
    )

    result = _assemble_letter_output(job, lang, selection, intro_candidates, close_candidates, achievement_candidates)
    used_block_ids = [
        b for b in [selection.get("intro_block_id"), selection.get("close_block_id")]
        if b
    ] + [b for b in (selection.get("hook_evidence_ids") or [])]

    run = GenerationRun(
        profile_id=payload.profile_id,
        job_description_id=payload.job_id,
        application_id=payload.application_id,
        run_type="cover_letter",
        selected_evidence_ids=used_block_ids,
        generation_inputs={"profile_id": payload.profile_id, "job_id": payload.job_id, "options": payload.options},
        generation_outputs=result,
        intermediate_repr=selection,
        model_name=settings.anthropic_model,
        prompt_version="2.0-selection",
        status="completed",
        completed_at=datetime.utcnow(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _assemble_letter_output(job, lang, selection, intro_candidates, close_candidates, achievement_candidates) -> dict:
    """Company name, position title and salutation come straight from the job
    record — never from the LLM — so a wrong-company mixup is structurally
    impossible, not just something a prompt asks the model to avoid."""
    intro_by_id = {b.id: b for b in intro_candidates}
    close_by_id = {b.id: b for b in close_candidates}
    achievement_by_id = {b.id: b for b in achievement_candidates}

    intro_id = selection.get("intro_block_id")
    intro_text = intro_by_id[intro_id].text if intro_id in intro_by_id else (
        _FALLBACK_INTRO.get(lang, _FALLBACK_INTRO["en"]).format(role=job.title or "", company=job.company or "")
    )

    close_id = selection.get("close_block_id")
    close_text = close_by_id[close_id].text if close_id in close_by_id else _FALLBACK_CLOSE.get(lang, _FALLBACK_CLOSE["en"])

    hook_text = selection.get("hook") or ""
    hook_evidence_ids = [eid for eid in (selection.get("hook_evidence_ids") or []) if eid in achievement_by_id]

    paragraphs = [{"text": intro_text, "paragraph_type": "opening", "evidence_ids": [intro_id] if intro_id in intro_by_id else []}]
    if hook_text:
        paragraphs.append({"text": hook_text, "paragraph_type": "motivation", "evidence_ids": hook_evidence_ids})
    paragraphs.append({"text": close_text, "paragraph_type": "closing", "evidence_ids": [close_id] if close_id in close_by_id else []})

    recipient_name = None  # no per-application contact tracking yet — always the generic salutation
    if recipient_name:
        opening_salutation = _OPENING_SALUTATION_NAMED.get(lang, _OPENING_SALUTATION_NAMED["en"]).format(name=recipient_name)
    else:
        opening_salutation = _OPENING_SALUTATION.get(lang, _OPENING_SALUTATION["en"])

    return {
        "recipient_name": recipient_name,
        "company_name": job.company or "",
        "position_title": job.title or "",
        "opening_salutation": opening_salutation,
        "paragraphs": paragraphs,
        "closing_salutation": _CLOSING_SALUTATION.get(lang, _CLOSING_SALUTATION["en"]),
    }
