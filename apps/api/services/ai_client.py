import base64
import json
import logging
import re
from anthropic import AsyncAnthropic
from config import settings

logger = logging.getLogger(__name__)
_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _fix_json_strings(raw: str) -> str:
    """Escape literal control characters AND fix common structural issues."""
    result = []
    in_string = False
    escape_next = False
    for ch in raw:
        if escape_next:
            result.append(ch)
            escape_next = False
            continue
        if ch == "\\" and in_string:
            result.append(ch)
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            result.append(ch)
            continue
        if in_string and ch == "\n":
            result.append("\\n")
            continue
        if in_string and ch == "\r":
            result.append("\\r")
            continue
        if in_string and ch == "\t":
            result.append("\\t")
            continue
        result.append(ch)
    fixed = "".join(result)
    # Remove trailing commas before } or ]
    fixed = re.sub(r",(\s*[}\]])", r"\1", fixed)
    return fixed


def _extract_json(raw: str) -> dict:
    """Try to parse JSON from raw text, with progressive recovery attempts."""
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    fixed = _fix_json_strings(raw)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse JSON from model: %s\nRaw (first 500): %s", e, raw[:500])
        raise ValueError(f"Model returned invalid JSON: {e}") from e


def _unwrap_json_strings(obj):
    """Recursively parse any string values that are valid JSON arrays/objects.

    Tool-Use sometimes encodes nested structures as JSON strings when the
    input_schema doesn't declare explicit types for those fields.
    """
    if isinstance(obj, dict):
        return {k: _unwrap_json_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_unwrap_json_strings(i) for i in obj]
    if isinstance(obj, str):
        stripped = obj.strip()
        if stripped.startswith(("[", "{")):
            try:
                return _unwrap_json_strings(json.loads(stripped))
            except json.JSONDecodeError:
                pass
    return obj


def _make_tool(schema_description: str) -> dict:
    return {
        "name": "return_structured_data",
        "description": (
            "Return the structured result as required. "
            f"Match this exact schema:\n{schema_description}"
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": True,
        },
    }


async def structured_generation(
    system: str,
    user: str,
    schema_description: str,
    max_tokens: int = 8192,
) -> dict:
    """Call Claude via Tool-Use to guarantee valid JSON output."""
    client = get_client()
    tool = _make_tool(schema_description)
    full_user = (
        f"{user}\n\n"
        f"Call return_structured_data with a result matching this schema exactly:\n"
        f"{schema_description}"
    )
    message = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        tools=[tool],
        tool_choice={"type": "tool", "name": "return_structured_data"},
        messages=[{"role": "user", "content": full_user}],
    )
    if message.stop_reason == "max_tokens":
        logger.warning("Response truncated (max_tokens=%d) — output may be incomplete", max_tokens)
    for block in message.content:
        if hasattr(block, "type") and block.type == "tool_use" and block.name == "return_structured_data":
            return _unwrap_json_strings(block.input)
    # Fallback: tool_choice was forced so this branch should never run
    raw = message.content[0].text.strip() if message.content else "{}"
    logger.warning("Tool-use fallback triggered — parsing text response")
    return _extract_json(raw)


async def structured_generation_with_pdf(
    system: str,
    user: str,
    schema_description: str,
    pdf_bytes: bytes | None = None,
    max_tokens: int = 8192,
) -> dict:
    client = get_client()
    tool = _make_tool(schema_description)
    schema_instruction = (
        f"\n\nCall return_structured_data with a result matching this schema:\n"
        f"{schema_description}"
    )
    if pdf_bytes:
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": base64.standard_b64encode(pdf_bytes).decode("utf-8"),
                },
            },
            {"type": "text", "text": user + schema_instruction},
        ]
    else:
        content = user + schema_instruction
    message = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        tools=[tool],
        tool_choice={"type": "tool", "name": "return_structured_data"},
        messages=[{"role": "user", "content": content}],
    )
    for block in message.content:
        if hasattr(block, "type") and block.type == "tool_use" and block.name == "return_structured_data":
            return _unwrap_json_strings(block.input)
    raw = message.content[0].text.strip() if message.content else "{}"
    logger.warning("Tool-use fallback triggered for PDF call — parsing text response")
    return _extract_json(raw)


async def free_generation(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> str:
    """Call Claude and return raw text response."""
    message = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text.strip()
