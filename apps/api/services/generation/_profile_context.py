import logging
from collections import defaultdict

from sqlmodel import Session, select

from models import (
    Experience, Project, Skill, LanguageSkill, Education,
    Publication, Certification, Achievement, EvidenceItem,
)

logger = logging.getLogger(__name__)


def build_full_profile_context(profile_id: str, session: Session) -> str:
    """Return ALL structured profile blocks as formatted prompt context.

    These data are authoritative — Claude must include every entry verbatim,
    without filtering by relevance.
    """
    blocks = []

    # ── EXPERIENCES ──────────────────────────────────────────────────────────
    experiences = session.exec(
        select(Experience)
        .where(Experience.profile_id == profile_id)
        .order_by(Experience.start_date.desc())
    ).all()
    if experiences:
        lines = ["EXPERIENCES (include ALL in Experience section, reverse-chronological):"]
        for e in experiences:
            date_range = _date_range(e.start_date, e.end_date)
            header = f"- {date_range} | {e.role_title or 'Role'} | {e.employer or 'Employer'}"
            if e.location:
                header += f", {e.location}"
            if e.employment_type:
                header += f" [{e.employment_type}]"
            lines.append(header)
            if e.description:
                lines.append(f"  Description: {e.description[:400]}")
            if e.tech_stack:
                lines.append(f"  Tech stack: {', '.join(str(t) for t in e.tech_stack)}")
            if e.bullets:
                for b in e.bullets[:8]:
                    lines.append(f"  • {b}")
        blocks.append("\n".join(lines))

    # ── PROJECTS ─────────────────────────────────────────────────────────────
    projects = session.exec(
        select(Project).where(Project.profile_id == profile_id)
    ).all()
    if projects:
        lines = ["PROJECTS (include ALL in Projects section):"]
        for p in projects:
            header = f"- {p.title or 'Project'}"
            if p.time_period:
                header += f" ({p.time_period})"
            if p.role:
                header += f" — {p.role}"
            lines.append(header)
            if p.description:
                lines.append(f"  Description: {p.description[:400]}")
            if p.technologies:
                lines.append(f"  Technologies: {', '.join(str(t) for t in p.technologies)}")
            if p.bullets:
                for b in p.bullets[:6]:
                    lines.append(f"  • {b}")
            if p.outcomes:
                for o in p.outcomes[:3]:
                    lines.append(f"  Outcome: {o}")
        blocks.append("\n".join(lines))

    # ── EDUCATION ─────────────────────────────────────────────────────────────
    educations = session.exec(
        select(Education)
        .where(Education.profile_id == profile_id)
        .order_by(Education.start_date.desc())
    ).all()
    if educations:
        lines = ["EDUCATION (include ALL in Education section, reverse-chronological):"]
        for ed in educations:
            date_range = _date_range(ed.start_date, ed.end_date)
            degree_str = " ".join(filter(None, [ed.degree, ed.field_of_study]))
            lines.append(f"- {date_range} | {degree_str or 'Degree'} | {ed.institution or 'Institution'}")
            if ed.grade:
                lines.append(f"  Grade: {ed.grade}")
            if ed.achievements:
                for a in ed.achievements[:3]:
                    lines.append(f"  • {a}")
        blocks.append("\n".join(lines))

    # ── PUBLICATIONS ──────────────────────────────────────────────────────────
    publications = session.exec(
        select(Publication).where(Publication.profile_id == profile_id)
    ).all()
    if publications:
        lines = ["PUBLICATIONS (include ALL in Publications section if present):"]
        for pub in publications:
            line = f"- {pub.title or 'Publication'}"
            if pub.venue:
                line += f" — {pub.venue}"
            if pub.published_date:
                line += f" ({pub.published_date})"
            if pub.pub_type:
                line += f" [{pub.pub_type}]"
            lines.append(line)
            if pub.abstract:
                lines.append(f"  Abstract: {pub.abstract[:300]}")
        blocks.append("\n".join(lines))

    # ── CERTIFICATIONS ────────────────────────────────────────────────────────
    certs = session.exec(
        select(Certification).where(Certification.profile_id == profile_id)
    ).all()
    if certs:
        lines = ["CERTIFICATIONS (include ALL in Certifications section):"]
        for c in certs:
            if not c.name:
                continue
            line = f"- {c.name}"
            if c.issuer:
                line += f" — {c.issuer}"
            if c.issued_date:
                line += f" ({c.issued_date})"
            lines.append(line)
        if len(lines) > 1:
            blocks.append("\n".join(lines))

    # ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
    achievements = session.exec(
        select(Achievement).where(Achievement.profile_id == profile_id)
    ).all()
    if achievements:
        lines = ["ACHIEVEMENTS (include in a dedicated Achievements or Highlights section):"]
        for a in achievements:
            line = f"- {a.statement or 'Achievement'}"
            if a.metric_value:
                line += f" ({a.metric_value})"
            if a.context:
                line += f" — {a.context}"
            lines.append(line)
        blocks.append("\n".join(lines))

    # ── SKILLS ────────────────────────────────────────────────────────────────
    skills = session.exec(
        select(Skill).where(Skill.profile_id == profile_id)
    ).all()
    if skills:
        by_cat: dict = defaultdict(list)
        for s in skills:
            by_cat[s.category or "Other"].append(s.name)
        lines = ["SKILLS (include ALL categories in Skills section):"]
        for cat, names in sorted(by_cat.items()):
            lines.append(f"  {cat}: {', '.join(names)}")
        blocks.append("\n".join(lines))

    # ── LANGUAGES ─────────────────────────────────────────────────────────────
    languages = session.exec(
        select(LanguageSkill).where(LanguageSkill.profile_id == profile_id)
    ).all()
    if languages:
        lines = ["LANGUAGES (include ALL in Languages section):"]
        for lang in languages:
            line = f"  - {lang.language}"
            if lang.level:
                line += f" ({lang.level})"
            lines.append(line)
        blocks.append("\n".join(lines))

    return "\n\n".join(blocks) if blocks else "No structured profile data available."


def build_smart_evidence_context(
    items: list,
    total_char_budget: int = 18_000,
) -> str:
    """Build evidence context with trust_level-based char budget allocation.

    Top items (by trust_level) get up to 1500 chars each;
    lower-trust items get 600 chars each.
    """
    if not items:
        return "No evidence available."

    sorted_items = sorted(items, key=lambda x: getattr(x, "trust_level", 1.0), reverse=True)
    top_k = min(10, len(sorted_items))
    parts = []
    used = 0

    for i, item in enumerate(sorted_items):
        per_item_budget = 1500 if i < top_k else 600
        if used + per_item_budget > total_char_budget:
            break
        text = (item.normalized_text or item.raw_text or "")[:per_item_budget]
        parts.append(
            f"[evidence_id: {item.id}] trust={getattr(item, 'trust_level', 1.0):.2f}\n"
            f"Source: {item.source_name} ({item.source_type})\n"
            f"Text: {text}"
        )
        used += len(text) + 80  # 80 chars for header overhead

    return "\n\n---\n\n".join(parts)


def _date_range(start: str | None, end: str | None) -> str:
    if start and end:
        return f"{start} to {end}"
    if start:
        return f"{start} to present"
    if end:
        return f"until {end}"
    return "dates unknown"
