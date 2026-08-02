"""Deterministic pre-export checks — no LLM call involved.

This is the fast, mechanical gate that catches the errors that actually happen
in practice: a leftover company name from the last application, an unfilled
placeholder, a missing salutation. It is not a fact-checker (see
services/validation.py for the LLM-based claim check) — it never judges
whether a claim is true, only whether the document is well-formed and
internally consistent with the job it claims to be for.
"""
import logging
import re

from sqlmodel import Session, select

from models import GenerationRun, JobDescription, ContentBlock, CandidateProfile
from schemas.preflight import PreflightCheck, PreflightReport, ApplicationPreflightReport

logger = logging.getLogger(__name__)

_PLACEHOLDER_PATTERNS = [
    r"\[[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß ]{1,30}\]",
    r"\bTODO\b",
    r"\bXXX\b",
    r"Lorem ipsum",
    r"\bMuster(mann|frau|firma)?\b",
]

_PAGE_LIMITS = {"resume": 2, "resume_pool": 3, "cover_letter": 1}


def run_preflight(run: GenerationRun, session: Session) -> PreflightReport:
    outputs = run.generation_outputs or {}
    job = session.get(JobDescription, run.job_description_id) if run.job_description_id else None
    text = _flatten_text(outputs, run.run_type)
    checks: list[PreflightCheck] = []

    if run.run_type == "cover_letter":
        checks.append(_check_company_referenced(job, text))
        checks.append(_check_salutation(outputs))

    checks.append(_check_no_foreign_company(session, job, text))
    checks.append(_check_no_placeholders(text))
    checks.append(_check_only_approved_blocks(session, outputs, run.run_type))
    checks.append(_check_page_limit(run, session))

    overall = _overall(checks)
    return PreflightReport(run_id=run.id, run_type=run.run_type, overall=overall, checks=checks)


def run_application_preflight(application_id: str, session: Session) -> ApplicationPreflightReport:
    runs = session.exec(
        select(GenerationRun)
        .where(GenerationRun.application_id == application_id)
        .order_by(GenerationRun.created_at.desc())
    ).all()
    latest_resume = next((r for r in runs if r.run_type in ("resume", "resume_pool", "resume_compact")), None)
    latest_letter = next((r for r in runs if r.run_type == "cover_letter"), None)

    resume_report = run_preflight(latest_resume, session) if latest_resume else None
    letter_report = run_preflight(latest_letter, session) if latest_letter else None

    reports = [r for r in (resume_report, letter_report) if r]
    overall = _overall_from_reports(reports) if reports else "block"

    return ApplicationPreflightReport(
        application_id=application_id, overall=overall,
        resume=resume_report, cover_letter=letter_report,
    )


# ── Individual checks ────────────────────────────────────────────────────────

def _check_company_referenced(job: JobDescription | None, text: str) -> PreflightCheck:
    company = (job.company or "").strip() if job else ""
    if not company:
        return PreflightCheck(
            code="company_missing", label="Firmenname im Job-Datensatz gesetzt",
            status="block", detail="Kein Firmenname in der Stellenanzeige hinterlegt.",
        )
    if company.lower() not in text.lower():
        return PreflightCheck(
            code="company_missing_in_text", label="Firmenname im Anschreiben enthalten",
            status="block", detail=f"'{company}' kommt im generierten Text nicht vor.",
        )
    return PreflightCheck(code="company_present", label="Firmenname im Anschreiben enthalten", status="pass")


def _check_no_foreign_company(session: Session, job: JobDescription | None, text: str) -> PreflightCheck:
    current = (job.company or "").strip().lower() if job else ""
    other_companies = session.exec(
        select(JobDescription.company).where(JobDescription.company.is_not(None))
    ).all()
    text_lower = text.lower()
    leaked = sorted({
        c for c in other_companies
        if c and c.strip() and c.strip().lower() != current and c.strip().lower() in text_lower
    })
    if leaked:
        return PreflightCheck(
            code="foreign_company_name", label="Kein fremder Firmenname im Text",
            status="block", detail=f"Gefunden: {', '.join(leaked)} — vermutlich Rest einer anderen Bewerbung.",
        )
    return PreflightCheck(code="no_foreign_company", label="Kein fremder Firmenname im Text", status="pass")


def _check_no_placeholders(text: str) -> PreflightCheck:
    for pattern in _PLACEHOLDER_PATTERNS:
        if re.search(pattern, text):
            return PreflightCheck(
                code="placeholder_found", label="Keine Platzhalter im Text",
                status="block", detail=f"Muster gefunden: {pattern}",
            )
    return PreflightCheck(code="no_placeholder", label="Keine Platzhalter im Text", status="pass")


def _check_only_approved_blocks(session: Session, outputs: dict, run_type: str) -> PreflightCheck:
    used_ids = _extract_block_ids(outputs, run_type)
    if not used_ids:
        return PreflightCheck(
            code="approved_blocks_ok", label="Nur freigegebene Bausteine verwendet",
            status="pass", detail="Keine Baustein-Referenzen — Legacy-Text wurde verwendet.",
        )
    rows = session.exec(select(ContentBlock).where(ContentBlock.id.in_(used_ids))).all()
    by_id = {b.id: b for b in rows}
    bad = [bid for bid in used_ids if bid not in by_id or not by_id[bid].approved]
    if bad:
        return PreflightCheck(
            code="unapproved_block", label="Nur freigegebene Bausteine verwendet",
            status="block", detail=f"{len(bad)} referenzierte(r) Baustein(e) nicht freigegeben oder gelöscht.",
        )
    return PreflightCheck(code="approved_blocks_ok", label="Nur freigegebene Bausteine verwendet", status="pass")


def _check_page_limit(run: GenerationRun, session: Session) -> PreflightCheck:
    limit = _PAGE_LIMITS.get(run.run_type, 2)
    try:
        from services.rendering import render_resume_html, render_cover_letter_html
        from weasyprint import HTML

        profile = session.get(CandidateProfile, run.profile_id)
        if run.run_type == "cover_letter":
            html = render_cover_letter_html(run, profile)
        else:
            html = render_resume_html(run, profile)
        page_count = len(HTML(string=html).render().pages)
    except Exception as e:
        logger.warning("Preflight page-count check failed: %s", e)
        return PreflightCheck(code="page_limit_error", label="Seitenzahl prüfbar", status="warn", detail=str(e))

    if page_count > limit:
        return PreflightCheck(
            code="page_limit", label=f"Seitenzahl ≤ {limit}",
            status="warn", detail=f"Dokument hat {page_count} Seite(n).",
        )
    return PreflightCheck(code="page_limit_ok", label=f"Seitenzahl ≤ {limit}", status="pass", detail=f"{page_count} Seite(n).")


def _check_salutation(outputs: dict) -> PreflightCheck:
    opening = (outputs.get("opening_salutation") or "").strip()
    if not opening:
        return PreflightCheck(code="salutation_missing", label="Anrede vorhanden", status="block")
    return PreflightCheck(code="salutation_ok", label="Anrede vorhanden", status="pass")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _flatten_text(outputs: dict, run_type: str) -> str:
    parts: list[str] = []
    if run_type in ("resume", "resume_pool", "resume_compact"):
        summary = outputs.get("professional_summary") or {}
        parts.append(summary.get("text", "") if isinstance(summary, dict) else str(summary))
        for section in outputs.get("sections", []):
            for item in section.get("items", []):
                parts.append(item.get("title") or "")
                parts.append(item.get("subtitle") or "")
                for b in item.get("bullets", []):
                    parts.append(b.get("text", "") if isinstance(b, dict) else str(b))
    elif run_type == "cover_letter":
        parts.append(outputs.get("opening_salutation", ""))
        for p in outputs.get("paragraphs", []):
            parts.append(p.get("text", ""))
        parts.append(outputs.get("closing_salutation", ""))
    return "\n".join(p for p in parts if p)


def _extract_block_ids(outputs: dict, run_type: str) -> set[str]:
    ids: set[str] = set()
    if run_type in ("resume", "resume_pool", "resume_compact"):
        summary = outputs.get("professional_summary") or {}
        ids.update(summary.get("evidence_ids") or [])
        for section in outputs.get("sections", []):
            for item in section.get("items", []):
                for b in item.get("bullets", []):
                    if isinstance(b, dict):
                        ids.update(b.get("evidence_ids") or [])
    elif run_type == "cover_letter":
        for p in outputs.get("paragraphs", []):
            ids.update(p.get("evidence_ids") or [])
    return ids


def _overall(checks: list[PreflightCheck]) -> str:
    if any(c.status == "block" for c in checks):
        return "block"
    if any(c.status == "warn" for c in checks):
        return "warn"
    return "pass"


def _overall_from_reports(reports: list[PreflightReport]) -> str:
    if any(r.overall == "block" for r in reports):
        return "block"
    if any(r.overall == "warn" for r in reports):
        return "warn"
    return "pass"
