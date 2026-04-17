# AI Career Copilot

Evidence-grounded resume and cover letter generation. Every generated claim traces back to source data — no hallucinations.

## Architecture

```
apps/web/    Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
apps/api/    FastAPI + SQLModel + Alembic + PostgreSQL
```

Full pipeline:
1. **Ingest** → upload PDF/DOCX/TXT → Claude extracts structured blocks
2. **Analyze** → paste job description → Claude extracts requirements
3. **Retrieve** → keyword scoring selects most relevant evidence blocks
4. **Generate** → multi-stage Claude pipeline produces resume + cover letter
5. **Validate** → Claude checks every claim against source evidence
6. **Export** → HTML preview + PDF download (weasyprint)

## Local Setup

### Prerequisites
- Docker + Docker Compose
- Node 20+
- Python 3.10+
- An Anthropic API key

### 1. Environment

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Database

```bash
docker compose up db -d
```

### 3. Backend

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
# Run migrations (requires DB to be running)
alembic upgrade head
uvicorn main:app --reload
```

API docs: http://localhost:8000/docs

### 4. Frontend

```bash
cd apps/web
npm install
npm run dev
```

App: http://localhost:3000

### 5. Seed demo data (optional)

```bash
python scripts/seed_demo_data.py
```

## Workflow

1. Go to **/profile** → create a profile → upload your CV
2. Review extracted blocks (experiences, skills, education, etc.)
3. Go to **/jobs** → paste a job description → review extracted requirements
4. Go to **/review** → load evidence pack, include/exclude blocks
5. Go to **/workspace** → generate resume, cover letter, match analysis
6. Validate output → download PDF

## Running Tests

```bash
cd apps/api
DATABASE_URL="sqlite:///:memory:" ANTHROPIC_API_KEY="test" pytest tests/ -v
```

## Generation Safety

The system uses a mandatory anti-hallucination policy:
- Prompts instruct Claude to use ONLY provided evidence IDs
- Every generated bullet must cite a source evidence_id
- A post-generation validation pass flags unsupported claims
- The UI shows validation warnings before export
- Omission is always preferred over fabrication

See [docs/prompting.md](docs/prompting.md) for prompt design details.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `UPLOAD_DIR` | No | Path for uploaded files (default: `./uploads`) |
| `MAX_UPLOAD_SIZE_MB` | No | Max file size in MB (default: 20) |
| `NEXT_PUBLIC_API_URL` | No | Backend URL for frontend (default: `http://localhost:8000`) |

## Limitations (MVP)

- No authentication — local development only
- Single user/profile mode in UI (data model supports multiple)
- Semantic/vector retrieval stubbed — keyword scoring only
- DOCX export not implemented (HTML + PDF only)
- No file size validation UI feedback yet
