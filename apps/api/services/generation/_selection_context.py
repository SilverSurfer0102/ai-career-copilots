"""Helpers for the block-selection generation pipeline.

The LLM never writes resume/cover-letter text here — it only ever picks IDs out
of the candidate lists built by this module. The text itself always comes from
approved ContentBlock rows (or, as a fallback for parents that haven't been
migrated to blocks yet, verbatim from the existing Experience/Project bullets).
"""
import re
from collections import defaultdict

from sqlmodel import Session, select

from models import ContentBlock


def collect_bullet_candidates(profile_id: str, session: Session) -> dict[str, list[ContentBlock]]:
    """Approved bullet blocks grouped by parent_id (experience/project entry)."""
    rows = session.exec(
        select(ContentBlock)
        .where(
            ContentBlock.profile_id == profile_id,
            ContentBlock.kind == "bullet",
            ContentBlock.approved == True,  # noqa: E712
        )
        .order_by(ContentBlock.priority)
    ).all()
    by_parent: dict[str, list[ContentBlock]] = defaultdict(list)
    for row in rows:
        if row.parent_id:
            by_parent[row.parent_id].append(row)
    return by_parent


def collect_summary_candidates(profile_id: str, session: Session) -> list[ContentBlock]:
    return session.exec(
        select(ContentBlock)
        .where(
            ContentBlock.profile_id == profile_id,
            ContentBlock.kind == "summary",
            ContentBlock.approved == True,  # noqa: E712
        )
        .order_by(ContentBlock.priority)
    ).all()


def collect_letter_fragments(profile_id: str, session: Session, kind: str) -> list[ContentBlock]:
    return session.exec(
        select(ContentBlock)
        .where(
            ContentBlock.profile_id == profile_id,
            ContentBlock.kind == kind,
            ContentBlock.approved == True,  # noqa: E712
        )
        .order_by(ContentBlock.priority)
    ).all()


def format_date_range(start: str | None, end: str | None, lang: str = "de") -> str:
    """MM/YYYY – MM/YYYY, the ATS-safe format. Falls back to raw text if it
    doesn't parse as YYYY-MM."""
    present = "heute" if lang == "de" else "Present"
    s = _format_single_date(start)
    e = _format_single_date(end) if end else present
    if not s and not end:
        return ""
    if not s:
        return e
    return f"{s} – {e}"


def _format_single_date(value: str | None) -> str:
    if not value:
        return ""
    m = re.match(r"^(\d{4})-(\d{2})(-\d{2})?$", value.strip())
    if m:
        year, month = m.group(1), m.group(2)
        return f"{month}/{year}"
    return value


def render_bullet_candidates_block(label: str, entries: list[dict]) -> str:
    """entries: [{"id": ..., "header": ..., "candidates": [ContentBlock, ...]}]"""
    lines = [label]
    for entry in entries:
        lines.append(f"\n{entry['id']} | {entry['header']}")
        candidates = entry["candidates"]
        if not candidates:
            lines.append("  (no approved candidate blocks — existing bullets will be used verbatim)")
            continue
        for block in candidates:
            tags = ", ".join((block.role_tags or []) + (block.keywords or []))
            lines.append(f"  - [{block.id}] ({tags}) {block.text[:160]}")
    return "\n".join(lines)
