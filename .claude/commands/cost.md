---
description: Gibt Sparempfehlungen und erinnert ans Token-Tracking
allowed-tools: Bash(echo *)
---

Gib mir eine kurze Einschätzung dieser Session:

1. Welche Aufgaben haben wahrscheinlich am meisten Tokens verbraucht?
2. Empfehlungen für die nächste Session:
   - Was hätte ich billiger lösen können?
   - Welche Tasks brauchen Opus+High, welche reichen mit Sonnet+Medium?
   - Sollte ich die Session mit "Clear conversation" neu starten?

Faustregel für dieses Projekt (VS Code Plugin):
- Lesen + schnelle Fixes → Sonnet, Effort Medium
- Planen + Architektur → Opus, Effort High, Thinking an → /opusplan Command
- Implementieren → Sonnet oder Opus, Effort Medium
- Nach ~30 Nachrichten: "Clear conversation" und neu starten mit /status

Hinweis: Den genauen Token-Verbrauch siehst du unter "Account & usage" im ... Menü.
