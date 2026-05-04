from collections import Counter
from sqlmodel import Session, select

from models import EditFeedback


def log_edit(
    run_id: str,
    profile_id: str,
    run_type: str,
    field_path: str,
    original_value: str,
    edited_value: str,
    session: Session,
) -> None:
    if not original_value or not edited_value:
        return
    if original_value == edited_value:
        return
    if len(edited_value.strip()) <= 3:
        return

    context = _infer_context(field_path)
    fb = EditFeedback(
        profile_id=profile_id,
        run_id=run_id,
        run_type=run_type,
        field_path=field_path,
        field_context=context,
        original_value=str(original_value),
        edited_value=str(edited_value),
    )
    session.add(fb)
    session.commit()


def get_feedback_context(profile_id: str, session: Session) -> str:
    items = session.exec(
        select(EditFeedback)
        .where(EditFeedback.profile_id == profile_id)
        .order_by(EditFeedback.created_at.desc())
        .limit(60)
    ).all()

    if not items:
        return ""

    patterns = []

    bullet_edits = [i for i in items if i.field_context == "experience_bullet"]
    if len(bullet_edits) >= 2:
        starts = [i.edited_value.split()[0] for i in bullet_edits if i.edited_value.split()]
        common = Counter(starts).most_common(3)
        if common and common[0][1] >= 2:
            verbs = ", ".join(w for w, _ in common)
            patterns.append(f"- Bullet-Texte beginnen bevorzugt mit: {verbs}")

    summary_edits = [i for i in items if i.field_context == "summary"]
    if summary_edits:
        patterns.append("- Zusammenfassung: nutze präzise Formulierungen wie in den korrigierten Versionen")

    title_edits = [i for i in items if i.field_context == "title"]
    if len(title_edits) >= 2:
        patterns.append("- Titel wurden mehrfach angepasst – schreibe sie klar und prägnant")

    if not patterns:
        return ""

    return "## Nutzer-Präferenzen (aus vergangenen Korrekturen gelernt)\n" + "\n".join(patterns)


def _infer_context(path: str) -> str:
    if "bullets" in path:
        return "experience_bullet"
    if "professional_summary" in path or "summary" in path:
        return "summary"
    if path.endswith(".title"):
        return "title"
    if path.endswith(".subtitle"):
        return "subtitle"
    if path.endswith(".date_range"):
        return "date_range"
    return "other"
