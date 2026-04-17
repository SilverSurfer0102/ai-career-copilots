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


async def structured_generation(
    system: str,
    user: str,
    schema_description: str,
    max_tokens: int = 4096,
) -> dict:
    """Call Claude and expect a JSON response. Returns parsed dict."""
    client = get_client()
    full_user = (
        f"{user}\n\n"
        f"Respond with ONLY valid JSON matching this schema:\n{schema_description}\n"
        f"No markdown, no explanation, just the JSON object."
    )
    message = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": full_user}],
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
