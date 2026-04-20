from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from sqlmodel import Session

from database import get_session
from models import GenerationRun, CandidateProfile
from services.rendering import render_resume_html, render_cover_letter_html, render_pdf
from services.latex_renderer import render_resume_latex

router = APIRouter()


def _load_run_and_profile(run_id: str, session: Session):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    profile = session.get(CandidateProfile, run.profile_id)
    return run, profile


@router.get("/runs/{run_id}/resume/html", response_class=HTMLResponse)
def preview_resume_html(run_id: str, session: Session = Depends(get_session)):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_resume_html(run, profile)
    return HTMLResponse(content=html)


@router.get("/runs/{run_id}/cover-letter/html", response_class=HTMLResponse)
def preview_cover_letter_html(run_id: str, session: Session = Depends(get_session)):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_cover_letter_html(run, profile)
    return HTMLResponse(content=html)


@router.get("/runs/{run_id}/resume/pdf")
def export_resume_pdf(run_id: str, session: Session = Depends(get_session)):
    run, profile = _load_run_and_profile(run_id, session)
    html = render_resume_html(run, profile)
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
