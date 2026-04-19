---
description: Zeigt den aktuellen Projektstatus — was läuft, was fehlt
allowed-tools: Read, Bash(git status), Bash(git log --oneline -5)
---

Lies die wichtigsten Dateien des Projekts und gib mir einen kompakten Status-Report:

1. Git-Status: Was hat sich seit dem letzten Commit geändert?
2. API-Status: Welche Endpoints existieren, welche sind noch TODO?
3. Frontend-Status: Welche Pages sind implementiert, welche sind Stubs?
4. Offene Baustellen: Was blockiert den nächsten Fortschritt?
5. Empfohlener nächster Schritt (1 konkreter Task)

Maximal 20 Zeilen. Direkt und ehrlich.
