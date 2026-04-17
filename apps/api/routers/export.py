from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlmodel import Session

from database import get_session
from models import GenerationRun
from services.rendering import render_resume_html, render_cover_letter_html, render_pdf

router = APIRouter()


@router.get("/runs/{run_id}/resume/html", response_class=HTMLResponse)
def preview_resume_html(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    html = render_resume_html(run)
    return HTMLResponse(content=html)


@router.get("/runs/{run_id}/cover-letter/html", response_class=HTMLResponse)
def preview_cover_letter_html(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    html = render_cover_letter_html(run)
    return HTMLResponse(content=html)


@router.get("/runs/{run_id}/resume/pdf")
def export_resume_pdf(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    html = render_resume_html(run)
    pdf_bytes = render_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resume_{run_id}.pdf"'},
    )


@router.get("/runs/{run_id}/cover-letter/pdf")
def export_cover_letter_pdf(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    html = render_cover_letter_html(run)
    pdf_bytes = render_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cover_letter_{run_id}.pdf"'},
    )
