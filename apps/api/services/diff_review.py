"""Builds a compact diff between a generated resume run and the full candidate
block pool, so the review UI can show only what changed instead of the full
document — the 15-second review the plan calls for instead of a 3-minute
full read."""
from sqlmodel import Session, select

from models import GenerationRun, ContentBlock


def build_resume_diff(run: GenerationRun, session: Session) -> dict:
    outputs = run.generation_outputs or {}
    entries = []

    for section in outputs.get("sections", []):
        if section.get("section_type") not in ("experience", "projects"):
            continue
        for item in section.get("items", []):
            parent_id = (item.get("metadata") or {}).get("parent_id")
            if not parent_id:
                continue
            included_ids = {
                bid for b in item.get("bullets", []) for bid in (b.get("evidence_ids") or [])
            }
            candidates = session.exec(
                select(ContentBlock).where(
                    ContentBlock.parent_id == parent_id,
                    ContentBlock.kind == "bullet",
                    ContentBlock.approved == True,  # noqa: E712
                )
            ).all()
            dropped = [b.text for b in candidates if b.id not in included_ids]
            entries.append({
                "parent_id": parent_id,
                "title": item.get("title", ""),
                "subtitle": item.get("subtitle", ""),
                "included": [b.get("text", "") for b in item.get("bullets", [])],
                "dropped": dropped,
                "is_legacy_fallback": not candidates,
            })

    summary = outputs.get("professional_summary") or {}
    summary_ids = set(summary.get("evidence_ids") or [])
    all_summary_candidates = session.exec(
        select(ContentBlock).where(
            ContentBlock.profile_id == run.profile_id,
            ContentBlock.kind == "summary",
            ContentBlock.approved == True,  # noqa: E712
        )
    ).all()

    return {
        "run_id": run.id,
        "summary_included": summary.get("text") or None,
        "summary_dropped": [b.text for b in all_summary_candidates if b.id not in summary_ids],
        "entries": entries,
    }
