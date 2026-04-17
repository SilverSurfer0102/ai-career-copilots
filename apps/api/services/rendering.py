import logging
from datetime import date
from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

_jinja_env = Environment(
    loader=FileSystemLoader("/app/templates"),
    autoescape=select_autoescape(["html"]),
)


def render_resume_html(run) -> str:
    outputs = run.generation_outputs or {}
    template = _jinja_env.get_template("resume.html.j2")

    summary = outputs.get("professional_summary", {})
    summary_text = summary.get("text", "") if isinstance(summary, dict) else str(summary)

    return template.render(
        candidate_name=outputs.get("candidate_name", ""),
        target_role=outputs.get("target_role", ""),
        contact="",
        professional_summary=summary_text,
        sections=outputs.get("sections", []),
        lang="en",
    )


def render_cover_letter_html(run) -> str:
    outputs = run.generation_outputs or {}
    template = _jinja_env.get_template("cover_letter.html.j2")

    return template.render(
        candidate_name="",
        contact="",
        date=date.today().strftime("%B %d, %Y"),
        recipient_name=outputs.get("recipient_name"),
        company_name=outputs.get("company_name", ""),
        position_title=outputs.get("position_title", ""),
        paragraphs=outputs.get("paragraphs", []),
        closing_salutation=outputs.get("closing_salutation", "Sincerely"),
        lang="en",
    )


def render_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML
        return HTML(string=html).write_pdf()
    except ImportError:
        raise RuntimeError("weasyprint is not installed. Run: pip install weasyprint")
