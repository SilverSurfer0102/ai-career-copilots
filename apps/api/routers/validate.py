from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from database import get_session
from models import GenerationRun
from schemas.validation import ValidationRequest, ValidationReportRead
from services.validation import validate_generation_run

router = APIRouter()


@router.post("/generated-output", response_model=ValidationReportRead)
async def validate_output(
    payload: ValidationRequest, session: Session = Depends(get_session)
):
    run = session.get(GenerationRun, payload.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    report = await validate_generation_run(run, session)
    return report
