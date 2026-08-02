import base64
import copy
import json
import logging
import os
import re
from datetime import date
from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

_jinja_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
)


def _parse_json_field(val, fallback):
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return fallback
    return val if val is not None else fallback


def _photo_data_url(photo_path: str) -> str | None:
    if not photo_path or not os.path.exists(photo_path):
        return None
    ext = photo_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(ext, "jpeg")
    try:
        with open(photo_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        return f"data:image/{mime};base64,{b64}"
    except Exception:
        logger.warning("Could not read photo at %s", photo_path)
        return None


def render_resume_html(run, profile=None, theme: str = "modern") -> str:
    outputs = run.generation_outputs or {}
    template = _jinja_env.get_template("resume.html.j2")

    summary_raw = outputs.get("professional_summary", {})
    summary_raw = _parse_json_field(summary_raw, {"text": ""})
    summary_text = summary_raw.get("text", "") if isinstance(summary_raw, dict) else str(summary_raw)

    sections = _parse_json_field(outputs.get("sections", []), [])

    email = phone = linkedin = github = website = photo_url = ""
    if profile:
        email = profile.email or ""
        phone = profile.phone or ""
        linkedin = profile.linkedin_url or ""
        github = profile.github_url or ""
        website = profile.website or ""
        if profile.photo_path:
            photo_url = _photo_data_url(profile.photo_path) or ""

    gen_inputs = run.generation_inputs or {}
    lang = gen_inputs.get("options", {}).get("language_override") or "de"

    return template.render(
        candidate_name=outputs.get("candidate_name", "") or (profile.display_name if profile else ""),
        target_role=outputs.get("target_role", ""),
        email=email,
        phone=phone,
        linkedin=linkedin,
        github=github,
        website=website,
        photo_url=photo_url,
        professional_summary=summary_text,
        sections=sections,
        lang=lang,
        theme=theme if theme in ("modern", "classic") else "modern",
    )


_GERMAN_MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]


def _format_date(lang: str) -> str:
    today = date.today()
    if lang == "de":
        return f"{today.day}. {_GERMAN_MONTHS[today.month - 1]} {today.year}"
    return today.strftime("%B %d, %Y")


def render_cover_letter_html(run, profile=None) -> str:
    outputs = run.generation_outputs or {}
    template = _jinja_env.get_template("cover_letter.html.j2")

    paragraphs = _parse_json_field(outputs.get("paragraphs", []), [])

    candidate_name = ""
    contact = ""
    if profile:
        candidate_name = profile.display_name or ""
        contact_parts = [p for p in (profile.email, profile.phone, profile.location) if p]
        contact = " · ".join(contact_parts)

    gen_inputs = run.generation_inputs or {}
    lang = gen_inputs.get("options", {}).get("language_override") or "de"

    return template.render(
        candidate_name=candidate_name,
        contact=contact,
        date=_format_date(lang),
        recipient_name=outputs.get("recipient_name"),
        company_name=outputs.get("company_name", ""),
        position_title=outputs.get("position_title", ""),
        opening_salutation=outputs.get("opening_salutation", ""),
        paragraphs=paragraphs,
        closing_salutation=outputs.get("closing_salutation", "Mit freundlichen Grüßen" if lang == "de" else "Sincerely"),
        lang=lang,
    )


_UMLAUT_MAP = str.maketrans({
    "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss",
})


def sanitize_filename(name: str, fallback: str = "Unbenannt") -> str:
    """Transliterates umlauts and strips anything that isn't safe across
    Windows/macOS/Linux filesystems and older unzip tools — application
    portals routinely reject uploads with special characters in the name."""
    name = (name or "").translate(_UMLAUT_MAP)
    name = re.sub(r"[^A-Za-z0-9 _-]", "", name).strip()
    name = re.sub(r"\s+", "_", name)
    return name or fallback


def render_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML
        return HTML(string=html).write_pdf()
    except ImportError:
        raise RuntimeError("weasyprint is not installed. Run: pip install weasyprint")
