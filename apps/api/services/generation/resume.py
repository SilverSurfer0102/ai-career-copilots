import logging
import time
from collections import defaultdict
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from models import (
    CandidateProfile, JobDescription, GenerationRun,
    Experience, Project, Education, Skill, LanguageSkill,
    Certification, Achievement, Publication, ContentBlock,
)
from schemas.generation import GenerationRequest
from services.ai_client import structured_generation
from prompts.generation import SELECTION_SYSTEM, SELECTION_SCHEMA
from config import settings
from ._selection_context import (
    collect_bullet_candidates, collect_summary_candidates,
    format_date_range, render_bullet_candidates_block,
)

logger = logging.getLogger(__name__)

MAX_BULLETS_PER_ENTRY = 4


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

    lang = payload.options.get("language_override") or job.output_language or "de"

    experiences = session.exec(
        select(Experience).where(Experience.profile_id == payload.profile_id)
        .order_by(Experience.start_date.desc())
    ).all()
    projects = session.exec(
        select(Project).where(Project.profile_id == payload.profile_id)
    ).all()

    bullet_candidates = collect_bullet_candidates(payload.profile_id, session)
    summary_candidates = collect_summary_candidates(payload.profile_id, session)

    exp_entries = [
        {
            "id": e.id,
            "header": f"{e.role_title or 'Role'} at {e.employer or 'Employer'} ({format_date_range(e.start_date, e.end_date, lang)})",
            "candidates": bullet_candidates.get(e.id, []),
        }
        for e in experiences
    ]
    proj_entries = [
        {
            "id": p.id,
            "header": f"{p.title or 'Project'} — {p.role or ''}".strip(" —"),
            "candidates": bullet_candidates.get(p.id, []),
        }
        for p in projects
    ]

    summary_block = "\n".join(
        f"  - [{b.id}] {b.text[:200]}" for b in summary_candidates
    ) or "  (no approved summary candidates — professional_summary will be omitted)"

    user_prompt = (
        f"Select and order content blocks for a tailored resume.\n\n"
        f"## Job\nTitle: {job.title}\nCompany: {job.company}\n"
        f"Must-have skills: {', '.join(job.must_have_skills or [])}\n"
        f"Nice-to-have skills: {', '.join(job.nice_to_have_skills or [])}\n"
        f"Responsibilities: {chr(10).join((job.responsibilities or [])[:10])}\n\n"
        f"## Summary candidates\n{summary_block}\n\n"
        f"{render_bullet_candidates_block('## Experience entries', exp_entries)}\n\n"
        f"{render_bullet_candidates_block('## Project entries', proj_entries)}\n\n"
        f"Language: {lang}\n{feedback_context}"
    )

    logger.info(
        "Selection start: profile=%s job=%s experiences=%d projects=%d",
        payload.profile_id, payload.job_id, len(experiences), len(projects),
    )
    t0 = time.perf_counter()

    selection = await structured_generation(
        system=SELECTION_SYSTEM,
        user=user_prompt,
        schema_description=SELECTION_SCHEMA,
        max_tokens=4096,
    )

    duration = time.perf_counter() - t0
    logger.info("Selection done in %.1fs", duration)

    result = _assemble_resume_output(
        profile=profile, job=job, lang=lang, selection=selection,
        experiences=experiences, projects=projects,
        bullet_candidates=bullet_candidates, summary_candidates=summary_candidates,
        session=session,
    )

    used_block_ids = _extract_used_block_ids(result)

    run = GenerationRun(
        profile_id=payload.profile_id,
        job_description_id=payload.job_id,
        application_id=payload.application_id,
        run_type="resume",
        selected_evidence_ids=used_block_ids,
        generation_inputs={
            "profile_id": payload.profile_id,
            "job_id": payload.job_id,
            "options": payload.options,
        },
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


def _assemble_resume_output(
    profile, job, lang, selection, experiences, projects,
    bullet_candidates, summary_candidates, session,
) -> dict:
    """Builds the final document deterministically. The LLM only supplied ids —
    every string here is either DB data or a block the candidate already approved."""
    picks_by_parent = {p["parent_id"]: p["block_ids"] for p in selection.get("picks", [])}
    valid_summary_ids = {b.id for b in summary_candidates}
    summary_block_id = selection.get("summary_block_id")
    summary_text = ""
    if summary_block_id in valid_summary_ids:
        summary_text = next(b.text for b in summary_candidates if b.id == summary_block_id)

    included_project_ids = set(selection.get("included_project_ids") or [])

    sections = []

    if experiences:
        items = []
        for e in experiences:
            bullets = _resolve_bullets(e.id, e.bullets, bullet_candidates, picks_by_parent)
            items.append({
                "item_type": "experience",
                "title": e.role_title or "",
                "subtitle": e.employer or "",
                "date_range": format_date_range(e.start_date, e.end_date, lang),
                "location": e.location or "",
                "bullets": bullets,
                "metadata": {"parent_id": e.id},
            })
        sections.append({"section_type": "experience", "title": _section_title("experience", lang), "items": items})

    relevant_projects = [p for p in projects if p.id in included_project_ids] or []
    if relevant_projects:
        items = []
        for p in relevant_projects:
            bullets = _resolve_bullets(p.id, p.bullets, bullet_candidates, picks_by_parent)
            items.append({
                "item_type": "project",
                "title": p.title or "",
                "subtitle": p.role or "",
                "date_range": p.time_period or "",
                "location": "",
                "bullets": bullets,
                "metadata": {"parent_id": p.id},
            })
        sections.append({"section_type": "projects", "title": _section_title("projects", lang), "items": items})

    educations = session.exec(
        select(Education).where(Education.profile_id == profile.id).order_by(Education.start_date.desc())
    ).all()
    if educations:
        items = [{
            "item_type": "education",
            "title": " ".join(filter(None, [ed.degree, ed.field_of_study])),
            "subtitle": ed.institution or "",
            "date_range": format_date_range(ed.start_date, ed.end_date, lang),
            "location": "",
            "bullets": _resolve_bullets(ed.id, ed.achievements, bullet_candidates, picks_by_parent),
            "metadata": {"parent_id": ed.id},
        } for ed in educations]
        sections.append({"section_type": "education", "title": _section_title("education", lang), "items": items})

    skills = session.exec(select(Skill).where(Skill.profile_id == profile.id)).all()
    if skills:
        by_cat: dict = defaultdict(list)
        for s in skills:
            by_cat[s.category or "Sonstige"].append(s.name)
        sections.append({
            "section_type": "skills",
            "title": _section_title("skills", lang),
            "items": [{
                "item_type": "skill_group", "title": "", "subtitle": None,
                "date_range": None, "location": None, "bullets": [],
                "metadata": dict(by_cat),
            }],
        })

    languages = session.exec(select(LanguageSkill).where(LanguageSkill.profile_id == profile.id)).all()
    if languages:
        sections.append({
            "section_type": "languages",
            "title": _section_title("languages", lang),
            "items": [{
                "item_type": "language", "title": lang_row.language,
                "subtitle": lang_row.level, "date_range": None, "location": None,
                "bullets": [], "metadata": {},
            } for lang_row in languages],
        })

    certs = session.exec(select(Certification).where(Certification.profile_id == profile.id)).all()
    certs = [c for c in certs if c.name]
    if certs:
        sections.append({
            "section_type": "certifications",
            "title": _section_title("certifications", lang),
            "items": [{
                "item_type": "certification", "title": c.name, "subtitle": c.issuer,
                "date_range": c.issued_date, "location": None, "bullets": [], "metadata": {},
            } for c in certs],
        })

    achievements = session.exec(select(Achievement).where(Achievement.profile_id == profile.id)).all()
    if achievements:
        sections.append({
            "section_type": "achievements",
            "title": _section_title("achievements", lang),
            "items": [{
                "item_type": "achievement", "title": a.statement or "", "subtitle": a.context,
                "date_range": a.metric_value, "location": None, "bullets": [], "metadata": {},
            } for a in achievements],
        })

    publications = session.exec(select(Publication).where(Publication.profile_id == profile.id)).all()
    if publications:
        sections.append({
            "section_type": "publications",
            "title": _section_title("publications", lang),
            "items": [{
                "item_type": "publication", "title": p.title or "", "subtitle": p.venue,
                "date_range": p.published_date, "location": None, "bullets": [], "metadata": {},
            } for p in publications],
        })

    return {
        "candidate_name": profile.display_name,
        "target_role": selection.get("target_role") or job.title or "",
        "professional_summary": {"text": summary_text, "evidence_ids": [summary_block_id] if summary_text else []},
        "sections": sections,
    }


def _resolve_bullets(parent_id, legacy_bullets, bullet_candidates, picks_by_parent) -> list[dict]:
    candidates = bullet_candidates.get(parent_id, [])
    if not candidates:
        legacy = legacy_bullets or []
        return [
            {"text": (b.get("text") if isinstance(b, dict) else b), "evidence_ids": []}
            for b in legacy[:MAX_BULLETS_PER_ENTRY] if b
        ]
    by_id = {b.id: b for b in candidates}
    picked_ids = [bid for bid in picks_by_parent.get(parent_id, []) if bid in by_id]
    if not picked_ids:
        picked_ids = [b.id for b in candidates[:MAX_BULLETS_PER_ENTRY]]
    return [
        {"text": by_id[bid].text, "evidence_ids": [bid]}
        for bid in picked_ids[:MAX_BULLETS_PER_ENTRY]
    ]


def _extract_used_block_ids(result: dict) -> list[str]:
    ids = set()
    summary = result.get("professional_summary") or {}
    ids.update(summary.get("evidence_ids") or [])
    for section in result.get("sections", []):
        for item in section.get("items", []):
            for bullet in item.get("bullets", []):
                ids.update(bullet.get("evidence_ids") or [])
    return list(ids)


_SECTION_TITLES = {
    "experience": {"de": "Berufserfahrung", "en": "Experience"},
    "projects": {"de": "Projekte", "en": "Projects"},
    "education": {"de": "Ausbildung", "en": "Education"},
    "skills": {"de": "Kenntnisse", "en": "Skills"},
    "languages": {"de": "Sprachen", "en": "Languages"},
    "certifications": {"de": "Zertifikate", "en": "Certifications"},
    "achievements": {"de": "Achievements", "en": "Achievements"},
    "publications": {"de": "Publikationen", "en": "Publications"},
}


def _section_title(key: str, lang: str) -> str:
    return _SECTION_TITLES.get(key, {}).get(lang, _SECTION_TITLES.get(key, {}).get("en", key.title()))
