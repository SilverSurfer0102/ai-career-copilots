import base64
import json
import logging
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
    """Escape literal control characters inside JSON string values."""
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
    return "".join(result)


async def structured_generation(
    system: str,
    user: str,
    schema_description: str,
    max_tokens: int = 8192,
) -> dict:
    """Call Claude and expect a JSON response. Returns parsed dict."""
    client = get_client()
    full_user = (
        f"{user}\n\n"
        f"Respond with ONLY valid JSON matching this schema:\n{schema_description}\n"
        f"IMPORTANT: Within JSON string values use \\n for newlines — never literal newline characters.\n"
        f"No markdown, no explanation, just the JSON object."
    )
    message = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": full_user}],
    )
    if message.stop_reason == "max_tokens":
        logger.warning("Response truncated (max_tokens=%d) — output may be incomplete", max_tokens)
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        fixed = _fix_json_strings(raw)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse JSON from model: %s\nRaw: %s", e, raw[:500])
            raise ValueError(f"Model returned invalid JSON: {e}") from e


async def structured_generation_with_pdf(
    system: str,
    user: str,
    schema_description: str,
    pdf_bytes: bytes | None = None,
    max_tokens: int = 8192,
) -> dict:
    client = get_client()
    schema_instruction = (
        f"\n\nRespond with ONLY valid JSON matching this schema:\n{schema_description}\n"
        f"No markdown, no explanation, just the JSON object."
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
        messages=[{"role": "user", "content": content}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse JSON from model: %s\nRaw: %s", e, raw[:500])
        raise ValueError(f"Model returned invalid JSON: {e}") from e


async def free_generation(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> str:
    """Call Claude and return raw text response."""
    client = get_client()
    message = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text.strip()
