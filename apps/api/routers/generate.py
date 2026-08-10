import copy
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models import CandidateProfile, JobDescription, GenerationRun
from schemas.generation import GenerationRequest, GenerationRunRead, OutputPatch, PoolResumeRequest
from services.generation.resume import generate_resume, get_or_create_generic_job
from services.generation.cover_letter import generate_cover_letter
from services.generation.match_analysis import generate_match_analysis
from services.feedback import get_feedback_context, log_edit

router = APIRouter()


@router.post("/pool-resume", response_model=GenerationRunRead)
async def run_pool_resume_generation(
    payload: PoolResumeRequest, session: Session = Depends(get_session)
):
    if not session.get(CandidateProfile, payload.profile_id):
        raise HTTPException(status_code=404, detail="Profile not found")
    generic_job = get_or_create_generic_job(session)
    feedback_ctx = get_feedback_context(payload.profile_id, session)
    request = GenerationRequest(
        profile_id=payload.profile_id, job_id=generic_job.id, options=payload.options,
    )
    run = await generate_resume(request, session, feedback_context=feedback_ctx, run_type="resume_pool")
    return run


@router.post("/resume", response_model=GenerationRunRead)
async def run_resume_generation(
    payload: GenerationRequest, session: Session = Depends(get_session)
):
    _validate_ids(payload, session)
    feedback_ctx = get_feedback_context(payload.profile_id, session)
    run = await generate_resume(payload, session, feedback_context=feedback_ctx)
    return run


@router.post("/cover-letter", response_model=GenerationRunRead)
async def run_cover_letter_generation(
    payload: GenerationRequest, session: Session = Depends(get_session)
):
    _validate_ids(payload, session)
    run = await generate_cover_letter(payload, session)
    return run


@router.post("/match-analysis", response_model=GenerationRunRead)
async def run_match_analysis(
    payload: GenerationRequest, session: Session = Depends(get_session)
):
    _validate_ids(payload, session)
    run = await generate_match_analysis(payload, session)
    return run


@router.get("/runs", response_model=list[GenerationRunRead])
def list_runs(
    application_id: Optional[str] = Query(default=None),
    run_type: Optional[str] = Query(default=None),
    profile_id: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    q = select(GenerationRun).order_by(GenerationRun.created_at.desc())
    if application_id:
        q = q.where(GenerationRun.application_id == application_id)
    if run_type:
        q = q.where(GenerationRun.run_type == run_type)
    if profile_id:
        q = q.where(GenerationRun.profile_id == profile_id)
    return session.exec(q).all()


@router.get("/runs/{run_id}", response_model=GenerationRunRead)
def get_run(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    return run


@router.delete("/runs/{run_id}", status_code=204)
def delete_run(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    session.delete(run)
    session.commit()


@router.patch("/runs/{run_id}/outputs", response_model=GenerationRunRead)
def patch_run_outputs(run_id: str, patch: OutputPatch, session: Session = Depends(get_session)):
    """Apply a dot-path update to generation_outputs for inline editing."""
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    outputs = copy.deepcopy(dict(run.generation_outputs or {}))

    original_value = None
    if patch.op == "set":
        try:
            original_value = _get_nested(outputs, patch.path)
        except (KeyError, IndexError, TypeError):
            original_value = None
        _set_nested(outputs, patch.path, patch.value)
    elif patch.op in ("append", "delete"):
        _mutate_array(outputs, patch.path, patch.op, patch.value)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown op: {patch.op}")

    run.generation_outputs = outputs
    session.add(run)
    session.commit()
    session.refresh(run)

    if patch.op == "set" and original_value is not None and patch.value is not None:
        log_edit(
            run_id=run_id,
            profile_id=run.profile_id,
            run_type=run.run_type,
            field_path=patch.path,
            original_value=str(original_value),
            edited_value=str(patch.value),
            session=session,
        )

    return run


@router.post("/runs/{run_id}/compact", response_model=GenerationRunRead)
async def compact_run(run_id: str, session: Session = Depends(get_session)):
    """Compact a resume run to 1-page length via a second Claude pass."""
    from services.generation.compact import compact_resume
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    if run.run_type not in ("resume", "resume_compact", "resume_pool"):
        raise HTTPException(status_code=400, detail="Only resume runs can be compacted")
    compact_run_obj = await compact_resume(run, session)
    return compact_run_obj


def _get_nested(obj, path: str):
    keys = path.split(".")
    current = obj
    for key in keys:
        current = current[int(key)] if isinstance(current, list) else current[key]
    return current


def _mutate_array(obj: dict, path: str, op: str, value) -> None:
    keys = path.split(".")
    current = obj
    for key in keys[:-1]:
        current = current[int(key)] if isinstance(current, list) else current[key]
    last = keys[-1]
    target = current[int(last)] if isinstance(current, list) else current[last]
    if op == "append":
        target.append(value)
    elif op == "delete":
        del target[int(value)]


def _set_nested(obj: dict, path: str, value) -> None:
    keys = path.split(".")
    current = obj
    for key in keys[:-1]:
        if isinstance(current, list):
            current = current[int(key)]
        else:
            current = current[key]
    last = keys[-1]
    if isinstance(current, list):
        current[int(last)] = value
    else:
        current[last] = value


def _validate_ids(payload: GenerationRequest, session: Session) -> None:
    if not session.get(CandidateProfile, payload.profile_id):
        raise HTTPException(status_code=404, detail="Profile not found")
    if not session.get(JobDescription, payload.job_id):
        raise HTTPException(status_code=404, detail="Job not found")
