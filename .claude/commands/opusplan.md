---
description: Startet eine intensive Planungssession mit Opus — für komplexe Features oder Architektur-Entscheidungen
allowed-tools: Read, Bash(git log --oneline -10), Bash(git status)
---

WICHTIG: Bevor du antwortest — erinnere mich:
"Bitte stelle manuell ein: Opus 4 + Effort High + Thinking an (... Menü oben rechts)"

Du bist jetzt im intensiven Planungsmodus. Keine Implementierung in dieser Session.

Aufgabe: $ARGUMENTS

Falls keine Aufgabe angegeben — analysiere den aktuellen Stand und erstelle
einen priorisierten Implementierungsplan für die nächsten 3 Feature-Blöcke.

Dein Output ist ein strukturierter Plan mit:

## Ziel
[Was soll am Ende funktionieren?]

## Risiken & offene Fragen
[Was könnte schiefgehen? Was muss ich entscheiden bevor ich anfange?]

## Phasen
Phase 1 — [Name] (geschätzter Aufwand: klein/mittel/groß)
  - Schritt 1: ...
  - Schritt 2: ...
  - Akzeptanzkriterium: ...

Phase 2 — ...

## Betroffene Dateien
[Welche Dateien werden sich ändern?]

## Was ich NICHT mache
[Explizit abgrenzen was out of scope ist]

Wenn der Plan fertig ist, warte auf Freigabe bevor du irgendetwas implementierst.
Danach: Effort auf Medium zurückstellen für die Umsetzung.
