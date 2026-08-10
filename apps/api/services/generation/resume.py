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
MAX_BULLETS_PER_ENTRY_GENERIC = 4


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
    # A "generic" job — one with no extracted requirements — signals this isn't
    # a specific application but a general-purpose profile CV (e.g. handed to a
    # contact for internal networking). Tailoring logic flips toward breadth.
    is_generic = not (job.must_have_skills or job.responsibilities)

    experiences = session.exec(
        select(Experience).where(Experience.profile_id == payload.profile_id)
        .order_by(Experience.start_date.desc())
    ).all()
    projects = session.exec(
        select(Project).where(Project.profile_id == payload.profile_id)
    ).all()
    skills = session.exec(select(Skill).where(Skill.profile_id == payload.profile_id)).all()
    achievements = session.exec(select(Achievement).where(Achievement.profile_id == payload.profile_id)).all()

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

    skills_block = "\n".join(
        f"  - [{s.id}] {s.name} ({s.category or 'other'})" for s in skills
    ) or "  (none)"
    achievements_block = "\n".join(
        f"  - [{a.id}] {a.statement or ''} ({a.metric_value or ''})" for a in achievements
    ) or "  (none)"

    if is_generic:
        mode_note = (
            "## Mode: GENERAL-PURPOSE PROFILE (no specific job)\n"
            "This is NOT a tailored application — there is no specific job to match against. "
            "It will be used to evaluate the candidate's overall breadth across multiple possible "
            "roles (e.g. handed to a contact for internal networking). Prefer breadth over narrow "
            "tailoring: include ALL projects (do not drop any for weak keyword match), pick the "
            "single strongest bullet for each one (space is tight across 7 entries), up to "
            f"{MAX_BULLETS_PER_ENTRY_GENERIC} bullets for the (few) work experience entries, "
            "select a wider skill set (~16-18, still representative rather than exhaustive), and "
            "pick the most versatile summary candidate — one that doesn't overcommit to a single "
            "narrow role. Achievements are dropped entirely in this mode (redundant with project "
            "bullets) — don't worry about achievement selection.\n\n"
        )
    else:
        mode_note = ""

    user_prompt = (
        f"Select and order content blocks for a tailored resume.\n\n"
        f"{mode_note}"
        f"## Job\nTitle: {job.title}\nCompany: {job.company}\n"
        f"Must-have skills: {', '.join(job.must_have_skills or [])}\n"
        f"Nice-to-have skills: {', '.join(job.nice_to_have_skills or [])}\n"
        f"Responsibilities: {chr(10).join((job.responsibilities or [])[:10])}\n\n"
        f"## Summary candidates\n{summary_block}\n\n"
        f"{render_bullet_candidates_block('## Experience entries', exp_entries)}\n\n"
        f"{render_bullet_candidates_block('## Project entries', proj_entries)}\n\n"
        f"## Skill candidates ({len(skills)} total — select a focused, relevant subset)\n{skills_block}\n\n"
        f"## Achievement candidates\n{achievements_block}\n\n"
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
        max_tokens=6144 if is_generic else 4096,
    )

    duration = time.perf_counter() - t0
    logger.info("Selection done in %.1fs", duration)

    result = _assemble_resume_output(
        profile=profile, job=job, lang=lang, selection=selection,
        experiences=experiences, projects=projects, skills=skills, achievements=achievements,
        bullet_candidates=bullet_candidates, summary_candidates=summary_candidates,
        session=session, is_generic=is_generic,
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
    profile, job, lang, selection, experiences, projects, skills, achievements,
    bullet_candidates, summary_candidates, session, is_generic=False,
) -> dict:
    """Builds the final document deterministically. The LLM only supplied ids —
    every string here is either DB data or a block the candidate already approved."""
    bullet_cap = MAX_BULLETS_PER_ENTRY_GENERIC if is_generic else MAX_BULLETS_PER_ENTRY
    picks_by_parent = {p["parent_id"]: p["block_ids"] for p in selection.get("picks", [])}
    valid_summary_ids = {b.id for b in summary_candidates}
    summary_block_id = selection.get("summary_block_id")
    summary_text = ""
    if summary_block_id in valid_summary_ids:
        summary_text = next(b.text for b in summary_candidates if b.id == summary_block_id)
    elif is_generic and summary_candidates:
        # Generic mode shouldn't end up with an empty profile section — fall
        # back to the candidate's own broadest/most-versatile summary variant
        # (highest priority = the one added most recently / most general on purpose).
        fallback_summary = max(summary_candidates, key=lambda b: b.priority)
        summary_text = fallback_summary.text
        summary_block_id = fallback_summary.id

    included_project_ids = set(selection.get("included_project_ids") or [])

    sections = []

    if experiences:
        items = []
        for e in experiences:
            bullets = _resolve_bullets(e.id, e.bullets, bullet_candidates, picks_by_parent, bullet_cap)
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

    if is_generic:
        relevant_projects = projects  # breadth is the explicit goal — show everything
    else:
        relevant_projects = [p for p in projects if p.id in included_project_ids]
        min_projects = min(2, len(projects))
        if len(relevant_projects) < min_projects and len(experiences) <= 2:
            # Safety net: for a candidate with little work history, projects are
            # the main evidence of skill — an empty/thin projects section is worse
            # than including the best-available ones even on an imperfect match.
            # The LLM was told this explicitly (SELECTION_SYSTEM rule 5); this is
            # the deterministic backstop in case it under-selects anyway.
            relevant_projects = projects[:3]
    if relevant_projects:
        # Showing many projects at once (generic/breadth mode) only stays
        # readable — and fits the requested page budget — if each one is tight.
        # Few projects can afford more room each; many projects each get less.
        project_bullet_cap = bullet_cap
        if is_generic:
            project_bullet_cap = 1 if len(relevant_projects) >= 5 else 2
        items = []
        minor_projects = []  # bulletless ones, folded into one compact trailing line
        for p in relevant_projects:
            bullets = _resolve_bullets(p.id, p.bullets, bullet_candidates, picks_by_parent, project_bullet_cap)
            if not bullets and is_generic and len(relevant_projects) >= 5:
                minor_projects.append(f"{p.title} ({p.time_period})" if p.time_period else p.title)
                continue
            description = _truncate_at_word(p.description, 220) if not bullets and p.description else ""
            items.append({
                "item_type": "project",
                "title": p.title or "",
                "subtitle": p.role or "",
                "date_range": p.time_period or "",
                "location": "",
                "bullets": bullets,
                "description": description,
                "metadata": {"parent_id": p.id},
            })
        if minor_projects:
            items.append({
                "item_type": "project",
                "title": "Weitere Studienarbeiten" if lang == "de" else "Additional coursework projects",
                "subtitle": None, "date_range": None, "location": None,
                "bullets": [], "description": "; ".join(minor_projects),
                "metadata": {},
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
            "bullets": _resolve_bullets(ed.id, ed.achievements, bullet_candidates, picks_by_parent, bullet_cap),
            "metadata": {"parent_id": ed.id},
        } for ed in educations]
        sections.append({"section_type": "education", "title": _section_title("education", lang), "items": items})

    included_skill_ids = set(selection.get("included_skill_ids") or [])
    valid_skill_ids = {s.id for s in skills}
    selected_skills = [s for s in skills if s.id in included_skill_ids & valid_skill_ids] or skills
    if is_generic:
        # Don't just ask nicely and hope — the LLM's "~16-18" guidance is a
        # suggestion, not a guarantee, and this is the one section still prone
        # to blowing the page budget on its own.
        selected_skills = selected_skills[:18]
    if selected_skills:
        group_labels = _SKILL_GROUP_LABELS_DE if lang == "de" else _SKILL_GROUP_LABELS_EN
        fallback_group = "Sonstige" if lang == "de" else "Other"
        by_cat: dict = defaultdict(list)
        for s in selected_skills:
            group = group_labels.get((s.category or "").lower(), fallback_group)
            if s.name not in by_cat[group]:
                by_cat[group].append(s.name)
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

    included_achievement_ids = set(selection.get("included_achievement_ids") or [])
    valid_achievement_ids = {a.id for a in achievements}
    selected_achievements = [a for a in achievements if a.id in included_achievement_ids & valid_achievement_ids]
    # Generic/breadth mode already shows every project with its own bullets —
    # a separate achievements section at that point is redundant filler, not
    # new information, and was pushing the page count past the 2-page budget.
    if selected_achievements and not is_generic:
        sections.append({
            "section_type": "achievements",
            "title": _section_title("achievements", lang),
            "items": [{
                "item_type": "achievement", "title": a.statement or "", "subtitle": a.context,
                "date_range": a.metric_value, "location": None, "bullets": [], "metadata": {},
            } for a in selected_achievements],
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


def _truncate_at_word(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut.rstrip(".,;:") + "…"


def _resolve_bullets(parent_id, legacy_bullets, bullet_candidates, picks_by_parent, cap=MAX_BULLETS_PER_ENTRY) -> list[dict]:
    candidates = bullet_candidates.get(parent_id, [])
    if not candidates:
        legacy = legacy_bullets or []
        return [
            {"text": (b.get("text") if isinstance(b, dict) else b), "evidence_ids": []}
            for b in legacy[:cap] if b
        ]
    by_id = {b.id: b for b in candidates}
    picked_ids = [bid for bid in picks_by_parent.get(parent_id, []) if bid in by_id]
    if not picked_ids:
        picked_ids = [b.id for b in candidates[:cap]]
    return [
        {"text": by_id[bid].text, "evidence_ids": [bid]}
        for bid in picked_ids[:cap]
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


# Merges the underlying Skill.category values into fewer, recruiter-facing
# groups. Internal categories stay fine-grained (useful for the LLM's
# selection reasoning) — this only affects how they're grouped on the page.
_SKILL_GROUP_LABELS_DE = {
    "technical": "Programmiersprachen & Tools", "framework": "Programmiersprachen & Tools",
    "tool": "Programmiersprachen & Tools", "domain": "Fachwissen", "soft": "Soft Skills",
    "methoden": "Methoden", "language": "Programmiersprachen & Tools",
}
_SKILL_GROUP_LABELS_EN = {
    "technical": "Languages & Tools", "framework": "Languages & Tools",
    "tool": "Languages & Tools", "domain": "Domain Knowledge", "soft": "Soft Skills",
    "methoden": "Methods", "language": "Languages & Tools",
}


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
