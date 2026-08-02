import io
import json
import zipfile

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from sqlmodel import Session, select

from database import get_session
from models import GenerationRun, CandidateProfile, Application, JobDescription
from schemas.export import BatchExportRequest
from services.rendering import render_resume_html, render_cover_letter_html, render_pdf, sanitize_filename
from services.latex_renderer import render_resume_latex
from services.preflight import run_application_preflight

router = APIRouter()


def _load_run_and_profile(run_id: str, session: Session):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    profile = session.get(CandidateProfile, run.profile_id)
    return run, profile


@router.get("/runs/{run_id}/resume/html", response_class=HTMLResponse)
def preview_resume_html(
    run_id: str,
    theme: str = Query(default="modern", pattern="^(modern|classic)$"),
    session: Session = Depends(get_session),
):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_resume_html(run, profile, theme=theme)
    return HTMLResponse(content=html)


@router.get("/runs/{run_id}/cover-letter/html", response_class=HTMLResponse)
def preview_cover_letter_html(run_id: str, session: Session = Depends(get_session)):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_cover_letter_html(run, profile)
    return HTMLResponse(content=html)


@router.get("/runs/{run_id}/resume/pdf")
def export_resume_pdf(
    run_id: str,
    theme: str = Query(default="modern", pattern="^(modern|classic)$"),
    session: Session = Depends(get_session),
):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_resume_html(run, profile, theme=theme)
    pdf_bytes = render_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resume_{run_id}.pdf"'},
    )


@router.get("/runs/{run_id}/resume/latex")
def export_resume_latex(
    run_id: str,
    template: str = Query(default="modern", pattern="^(modern|classic|academic)$"),
    session: Session = Depends(get_session),
):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    tex = render_resume_latex(run, template_name=template)
    filename = f"resume_{template}_{run_id[:8]}.tex"
    return Response(
        content=tex.encode("utf-8"),
        media_type="application/x-tex",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/runs/{run_id}/cover-letter/pdf")
def export_cover_letter_pdf(run_id: str, session: Session = Depends(get_session)):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_cover_letter_html(run, profile)
    pdf_bytes = render_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cover_letter_{run_id}.pdf"'},
    )


@router.post("/batch")
def export_batch(payload: BatchExportRequest, session: Session = Depends(get_session)):
    """Bundles finished applications into one ZIP, one folder per company, with
    upload-ready filenames. Applications whose latest documents fail a
    block-level pre-flight check (wrong company name, missing salutation, …)
    are left out and reported back in the X-Batch-Export-Skipped header —
    never silently dropped."""
    theme = payload.theme if payload.theme in ("modern", "classic") else "modern"
    buffer = io.BytesIO()
    skipped = []
    exported = []

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for app_id in payload.application_ids:
            application = session.get(Application, app_id)
            if not application:
                skipped.append({"application_id": app_id, "reason": "Bewerbung nicht gefunden"})
                continue

            report = run_application_preflight(app_id, session)
            if report.overall == "block":
                failing = [
                    c.label for r in (report.resume, report.cover_letter) if r
                    for c in r.checks if c.status == "block"
                ]
                skipped.append({"application_id": app_id, "reason": "Pre-Flight blockiert: " + "; ".join(failing)})
                continue

            job = session.get(JobDescription, application.job_id)
            profile = session.get(CandidateProfile, application.profile_id)
            company_folder = sanitize_filename(job.company if job else None, fallback="Unbekannte_Firma")
            lastname = (profile.display_name.split()[-1] if profile and profile.display_name else "Bewerbung")
            lastname = sanitize_filename(lastname)

            runs = session.exec(
                select(GenerationRun).where(GenerationRun.application_id == app_id)
                .order_by(GenerationRun.created_at.desc())
            ).all()
            resume_run = next((r for r in runs if r.run_type in ("resume", "resume_pool", "resume_compact")), None)
            letter_run = next((r for r in runs if r.run_type == "cover_letter"), None)

            if resume_run:
                html = render_resume_html(resume_run, profile, theme=theme)
                zf.writestr(f"{company_folder}/Lebenslauf_{lastname}.pdf", render_pdf(html))
            if letter_run:
                html = render_cover_letter_html(letter_run, profile)
                zf.writestr(f"{company_folder}/Anschreiben_{lastname}.pdf", render_pdf(html))

            if not resume_run and not letter_run:
                skipped.append({"application_id": app_id, "reason": "Keine generierten Dokumente vorhanden"})
                continue
            exported.append(app_id)

    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="bewerbungen.zip"',
            "X-Batch-Export-Skipped": json.dumps(skipped, ensure_ascii=False),
        },
    )
