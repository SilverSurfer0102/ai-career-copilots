"""Client for the (unofficial but public) Bundesagentur für Arbeit Jobsuche API.

No registration needed — the X-API-Key below is the fixed, publicly known
value the official "Jobsuche" mobile app itself uses. This is the largest
German job database and the only source in this project that is queried
programmatically; LinkedIn/Stepstone are deliberately NOT scraped here since
that would violate their terms of service (see docs/PLAN-v2-bausteinsystem.md).
"""
import base64
import hashlib
import logging

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service"
_HEADERS = {"X-API-Key": "jobboerse-jobsuche"}


def dedupe_hash(company: str | None, title: str, location: str | None) -> str:
    key = "|".join(s.strip().lower() for s in (company or "", title or "", location or ""))
    return hashlib.sha256(key.encode()).hexdigest()


async def search_jobs(query: str, location: str = "", radius_km: int = 25, size: int = 25) -> list[dict]:
    """Returns a list of lightweight lead dicts (no full description yet —
    call fetch_job_description for that, only once the user likes a lead)."""
    params = {
        "was": query,
        "angebotsart": 1,
        "page": 1,
        "size": min(size, 100),
        "umkreis": radius_km,
    }
    if location:
        params["wo"] = location

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{_BASE_URL}/pc/v4/app/jobs", params=params, headers=_HEADERS)
        resp.raise_for_status()
        data = resp.json()

    leads = []
    for entry in data.get("stellenangebote", []):
        ort = entry.get("arbeitsort") or {}
        location_str = ", ".join(filter(None, [ort.get("plz"), ort.get("ort")]))
        title = entry.get("titel", "")
        company = entry.get("arbeitgeber")
        leads.append({
            "external_id": entry.get("refnr"),
            "title": title,
            "company": company,
            "location": location_str,
            "url": entry.get("externeUrl"),
            "posted_at": entry.get("aktuelleVeroeffentlichungsdatum"),
            "dedupe_hash": dedupe_hash(company, title, location_str),
        })
    return leads


async def fetch_job_description(external_id: str) -> str:
    """Fetches the full description text for a native Bundesagentur posting.
    Returns an empty string for externally-hosted postings (no detail endpoint
    available) — the candidate can still open the lead's url manually."""
    encoded = base64.b64encode(external_id.encode()).decode()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{_BASE_URL}/pc/v4/jobdetails/{encoded}", headers=_HEADERS)
        if resp.status_code != 200:
            logger.info("No detail text available for external_id=%s (status %s)", external_id, resp.status_code)
            return ""
        data = resp.json()
        if "messages" in data:
            return ""
        return data.get("stellenangebotsBeschreibung", "") or ""
