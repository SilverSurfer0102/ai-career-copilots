import json
import logging
from sqlmodel import Session, select

from models import GenerationRun, EvidenceItem
from schemas.validation import ValidationReportRead, ClaimValidation
from services.ai_client import structured_generation
from prompts.generation import VALIDATION_SYSTEM, VALIDATION_SCHEMA

logger = logging.getLogger(__name__)


async def validate_generation_run(
    run: GenerationRun, session: Session
) -> ValidationReportRead:
    outputs = run.generation_outputs or {}
    evidence_ids = run.selected_evidence_ids or []

    evidence_items = session.exec(
        select(EvidenceItem).where(EvidenceItem.id.in_(evidence_ids))
    ).all() if evidence_ids else []

    evidence_context = "\n\n".join(
        f"[evidence_id: {item.id}]\n{(item.normalized_text or item.raw_text)[:600]}"
        for item in evidence_items
    ) or "No evidence items available."

    generated_text = _flatten_generation_output(outputs, run.run_type)

    user_prompt = (
        f"Validate the following generated content against the provided evidence.\n\n"
        f"## Generated Content ({run.run_type})\n{generated_text}\n\n"
        f"## Source Evidence\n{evidence_context}"
    )

    try:
        result = await structured_generation(
            system=VALIDATION_SYSTEM,
            user=user_prompt,
            schema_description=VALIDATION_SCHEMA,
            max_tokens=4096,
        )
    except Exception as e:
        logger.error("Validation LLM call failed: %s", e)
        return ValidationReportRead(
            run_id=run.id,
            overall_supported=False,
            unsupported_count=0,
            high_risk_count=0,
            claims=[],
            summary=f"Validation could not be completed: {e}",
        )

    claims = [
        ClaimValidation(
            claim=c.get("claim", ""),
            supported=c.get("supported", False),
            evidence_ids=c.get("evidence_ids", []),
            risk_level=c.get("risk_level", "medium"),
            reason=c.get("reason"),
        )
        for c in result.get("claims", [])
    ]

    unsupported = sum(1 for c in claims if not c.supported)
    high_risk = sum(1 for c in claims if c.risk_level == "high")

    report = ValidationReportRead(
        run_id=run.id,
        overall_supported=result.get("overall_supported", False),
        unsupported_count=unsupported,
        high_risk_count=high_risk,
        claims=claims,
        summary=result.get("summary", ""),
    )

    run.validation_report = {
        "overall_supported": report.overall_supported,
        "unsupported_count": report.unsupported_count,
        "high_risk_count": report.high_risk_count,
        "summary": report.summary,
        "claims": [c.model_dump() for c in claims],
    }
    session.add(run)
    session.commit()

    return report


def _flatten_generation_output(outputs: dict, run_type: str) -> str:
    if run_type == "resume":
        lines = []
        summary = outputs.get("professional_summary", {})
        if summary:
            lines.append(f"Summary: {summary.get('text', '')}")
        for section in outputs.get("sections", []):
            lines.append(f"\n## {section.get('title', '')}")
            for item in section.get("items", []):
                lines.append(f"  {item.get('title', '')} — {item.get('subtitle', '')}")
                for bullet in item.get("bullets", []):
                    lines.append(f"    • {bullet.get('text', '')}")
        return "\n".join(lines)

    elif run_type == "cover_letter":
        return "\n\n".join(p.get("text", "") for p in outputs.get("paragraphs", []))

    elif run_type == "match_analysis":
        lines = [f"Fit: {outputs.get('fit_level', '')} ({outputs.get('overall_fit_score', '')}%)"]
        lines.append(f"Summary: {outputs.get('summary', '')}")
        for s in outputs.get("strengths", []):
            lines.append(f"Strength: {s.get('description', '')}")
        for g in outputs.get("gaps", []):
            lines.append(f"Gap: {g.get('requirement', '')} — {g.get('gap_type', '')}")
        return "\n".join(lines)

    return str(outputs)
