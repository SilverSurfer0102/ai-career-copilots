# Security & Privacy

## Personal Data

This application stores sensitive personal career data including:
- Full name, email, phone number, location
- Employment history with dates and metrics
- Education and certification details
- Uploaded documents (PDF, DOCX)

**Default posture: local-dev only.** There is no authentication in the MVP. Do not expose this application to the public internet without adding auth.

## Secrets Management

- Never commit `.env` files — only `.env.example` (with no real values) is committed
- `ANTHROPIC_API_KEY` must be kept secret — it is never logged
- `SECRET_KEY` is available for future session/JWT use — change from default in any deployment

## Data Sent to Anthropic

The following is sent to the Anthropic API:
- Extracted text from uploaded documents (for ingestion normalization)
- Job description text (for analysis)
- Evidence block content (for generation and validation)

**Mitigation:** Only the portions needed for each call are sent. Raw file bytes are never sent — only parsed text. Users should be aware their career data reaches Anthropic's API.

## File Storage

- Uploaded files are stored in `UPLOAD_DIR` (default: `./uploads/`)
- Files are organized by profile ID
- Original files are retained alongside extracted data
- `data/raw/`, `data/uploads/`, `outputs/`, `tmp/` are gitignored

## Auth (Not Implemented)

Authentication is explicitly deferred from the MVP. To add it:
1. Add a `users` table
2. Add `user_id` FK to `CandidateProfile`
3. Add FastAPI middleware (e.g. JWT or session-based)
4. Add login/register endpoints

## Logging

- Sensitive document content is not logged at INFO level
- API key values are never logged
- Structured logging via `structlog` (configured in `main.py`)

## Limitations

- No rate limiting in MVP
- No input sanitization beyond Pydantic validation
- No virus scanning for uploaded files
- No encryption at rest for uploaded files
