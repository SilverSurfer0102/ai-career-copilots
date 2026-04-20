import os
import re
from jinja2 import Environment, FileSystemLoader

_LATEX_TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "latex")

_LATEX_CHAR_MAP = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]


def _latex_escape(text: str) -> str:
    if not text:
        return ""
    # Escape backslash first to avoid double-escaping
    text = text.replace("\\", r"\textbackslash{}")
    for old, new in _LATEX_CHAR_MAP[1:]:
        text = text.replace(old, new)
    return text


def _make_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(_LATEX_TEMPLATES_DIR),
        autoescape=False,
        block_start_string="<%",
        block_end_string="%>",
        variable_start_string="<<",
        variable_end_string=">>",
        comment_start_string="<#",
        comment_end_string="#>",
    )
    env.filters["e"] = _latex_escape
    env.filters["latex"] = _latex_escape
    return env


_env = _make_env()


def render_resume_latex(run, template_name: str = "modern") -> str:
    outputs = run.generation_outputs or {}
    template_file = f"{template_name}.tex.j2"
    template = _env.get_template(template_file)

    summary = outputs.get("professional_summary", {})
    summary_text = summary.get("text", "") if isinstance(summary, dict) else str(summary or "")

    return template.render(
        candidate_name=outputs.get("candidate_name", ""),
        target_role=outputs.get("target_role", ""),
        professional_summary=summary_text,
        sections=outputs.get("sections", []),
    )
