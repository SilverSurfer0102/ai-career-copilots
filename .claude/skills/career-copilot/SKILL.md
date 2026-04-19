---
name: career-copilot
description: Aktiviere diesen Skill für alle Aufgaben in diesem Projekt. Enthält Architektur-Kontext, Konventionen und Projektziele.
---

# Career Copilot — Project Skill

## Architektur-Überblick
- FastAPI Backend (apps/api/) mit service-layer Architektur
- Next.js Frontend (apps/web/) mit shadcn/ui Komponenten
- SQLite + Alembic — später PostgreSQL + pgvector
- Generierungs-Pipeline: Profil → Retrieval → LLM → Validierung → LaTeX/PDF

## Wichtigste Konventionen
- Pydantic Schemas in apps/api/schemas/ — immer tippen, nie dict
- Prompt-Templates gehören in apps/api/prompts/ — nie inline in Services
- Frontend API-Calls nur über apps/web/lib/api.ts — nie direkt fetch()
- Neue Features erst als Schema + Service, dann Router, dann UI

## Projektziele (Priorität)
1. Profil-Erstellung nutzerfreundlich — strukturierte Eingabe aller Career-Daten
2. LaTeX-Output — CV + Anschreiben auf Deutsch, 3 Template-Varianten
3. Evidence-grounded Generation — kein Halluzinieren, nur Profil-Fakten

## Kosten-Bewusstsein
- Große Lese-Operationen (ganzes Repo scannen) → nur wenn nötig
- Für reine Analyse-Tasks: /model sonnet statt opus
- Für Planungs-Tasks: /model opusplan
- Nach intensiven Sessions: /cost checken

## Non-Goals (nicht implementieren)
- Multi-Tenant Auth, Payments, Browser-Automation, Social Features
