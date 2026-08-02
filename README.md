# AI Career Copilot

Evidence-grounded Bewerbungsassistent. Der Kern: fast der gesamte Dokumenttext
kommt aus Textbausteinen, die du selbst einmal formulierst und freigibst — die
KI wählt pro Bewerbung nur aus, ordnet und schreibt maximal einen kurzen,
firmenspezifischen Absatz im Anschreiben selbst. Dadurch ist Halluzination
strukturell ausgeschlossen, nicht nur durch Prompt-Regeln verboten.

## Architektur

```
apps/web/    Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
apps/api/    FastAPI + SQLModel + Alembic + SQLite
```

Pipeline:

1. **Ingest** — CV/Zeugnis/Zertifikat hochladen oder Freitext eingeben → Claude extrahiert strukturierte Blöcke (Erfahrungen, Skills, Ausbildung, …)
2. **Bausteine freigeben** — aus den extrahierten Daten (oder manuell) Textbausteine je Erfahrung/Projekt formulieren und freigeben (`approved`) — einmaliger Aufwand, der jede spätere Bewerbung trägt
3. **Stellen sammeln** — Bundesagentur-für-Arbeit-API durchsuchen oder Stellen von LinkedIn/Stepstone manuell einfügen (**kein Scraping** — verstößt gegen deren ToS)
4. **Swipen** — im Stellen-Feed durchgehen, bei „Bewerben" wird automatisch eine Bewerbung angelegt
5. **Generieren** — die KI *wählt* passende Bausteine aus (Selektions-Pipeline) und schreibt nur den Anschreiben-Hook neu; der restliche Text ist deiner
6. **Pre-Flight-Check** — deterministische Prüfung vor jedem Export: richtiger Firmenname, kein Rest einer anderen Bewerbung im Text, keine Platzhalter, nur freigegebene Bausteine, Seitenlimit
7. **Export** — PDF (HTML/CSS → weasyprint) einzeln oder als ZIP-Batch mit einem Ordner pro Firma; optionaler LaTeX-Export als Zusatzformat (`.tex`, manuell kompilierbar, z. B. via Overleaf)

Details und Hintergrund: [docs/PLAN-v2-bausteinsystem.md](docs/PLAN-v2-bausteinsystem.md).

## Lokales Setup

### Voraussetzungen
- Node 20+
- Python 3.10+
- Ein Anthropic API Key

Kein Docker, kein PostgreSQL nötig — das Projekt läuft mit SQLite.

### 1. Backend

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# .env öffnen und ANTHROPIC_API_KEY setzen
alembic upgrade head
uvicorn main:app --reload
```

API-Docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd apps/web
npm install
npm run dev
```

App: http://localhost:3000

### 3. Demo-Daten (optional)

```bash
cd apps/api && source .venv/bin/activate
python ../../scripts/seed_demo_data.py
```

## Workflow

1. **/profile** — Profil anlegen, CV hochladen oder Freitext eingeben, Kontaktdaten pflegen
2. Erfahrungen/Projekte in Textbausteine umwandeln (`POST /profiles/{id}/content-blocks/bootstrap`) und im Profil freigeben — bis das nicht passiert ist, greift die Generierung übergangsweise auf die Rohdaten zurück
3. **/swipe** — Stellen suchen (Bundesagentur) oder einfügen, durchswipen
4. **/applications** — Bewerbung öffnen, Resume/Anschreiben generieren, Diff-Review statt Volltext-Review
5. Mehrere fertige Bewerbungen auswählen → **Export** als ZIP

## Tests

```bash
cd apps/api
source .venv/bin/activate
DATABASE_URL="sqlite:///:memory:" ANTHROPIC_API_KEY="test" pytest tests/ -v
```

## Generierungs-Sicherheit

- Der Dokumenttext selbst kommt aus vom Nutzer freigegebenen `ContentBlock`-Einträgen — die KI gibt nur IDs zurück, nie Freitext für Bullets/Summary
- Server-seitige Härtung: unbekannte oder nicht freigegebene Block-IDs werden verworfen, nie geraten
- Einziger generierter Freitext ist der 2–3-Satz-Anschreiben-Hook — dort bleibt eine optionale LLM-Validierung (`/validate`) verfügbar
- Pre-Flight-Check vor jedem Export: Firmenname korrekt, kein fremder Firmenname im Text, keine Platzhalter, Seitenlimit
- Fehlt die Baustein-Kuration für eine Erfahrung noch, wird auf die unveränderten Rohdaten zurückgegriffen — nie auf erfundenen Text

Details: [docs/prompting.md](docs/prompting.md).

## Environment-Variablen

| Variable | Erforderlich | Beschreibung |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Ja | Anthropic API Key |
| `ANTHROPIC_MODEL` | Nein | Default: `claude-sonnet-4-6` |
| `DATABASE_URL` | Ja | SQLite-Pfad, z. B. `sqlite:///./career_copilot.db` |
| `UPLOAD_DIR` | Nein | Pfad für Uploads (Default: `./uploads`) |
| `MAX_UPLOAD_SIZE_MB` | Nein | Max. Dateigröße in MB (Default: 20) |
| `NEXT_PUBLIC_API_URL` | Nein | Backend-URL fürs Frontend (Default: `http://localhost:8000`) |

## Bekannte Grenzen

- Keine Authentifizierung — nur für lokale Einzelnutzung gedacht
- LaTeX-Export liefert nur `.tex`-Quelltext; ohne installierte TeX-Distribution (z. B. MacTeX/tectonic) muss extern kompiliert werden (z. B. Overleaf)
- Job-Quellen: nur Bundesagentur-API + manuelles Einfügen — kein automatisches Scraping von LinkedIn/Stepstone (ToS)
- Kein automatischer Bewerbungsversand — Bewerbungen laufen über die Firmenportale, das System liefert nur die fertigen Unterlagen
- DOCX-Export nicht implementiert (nur HTML/PDF, optional `.tex`)
