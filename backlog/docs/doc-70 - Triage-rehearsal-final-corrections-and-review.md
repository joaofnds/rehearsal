---
id: doc-70
title: Triage rehearsal final corrections and review
type: other
created_date: '2026-09-09 16:26'
updated_date: '2026-09-09 16:26'
---
# Final corrections and review, 2026-09-09

Parent: doc-61. These are readback corrections; complete replaced fields follow.

```json
[
  {
    "id": "ACT-50",
    "before": {
      "documentation": [
        "doc-37"
      ]
    },
    "after": {
      "documentation": [
        "backlog/docs/doc-37 - reflection-ACT-50.md"
      ]
    },
    "state": "read-back verified"
  },
  {
    "id": "ACT-116",
    "before": {
      "status": "To Do",
      "implementationNotes": "Triage 2026-09-08 (e): citation error. The function is named claudeProjectsDirectory (session-capture.ts:13), not defaultProjectsDirectory as the card states. resolveSessionFile at :76 is correctly cited. Substance unchanged: case capture only resolves against ~/.claude/projects.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: implementation. Priority: medium. Capture cannot reuse harness-owned evidence, which adds manual work to session-case construction.\n\nEvidence: case capture searches only claudeProjectsDirectory; harness transcripts live under .benchmark-runs/sessions; focused capture tests cover only the former.\n\nUnresolved claims/resources: None for the next action.\n\nNext action: Resolve IDs over both stores with explicit ambiguity behavior and retain interactive-session coverage.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "after": {
      "status": "Shape",
      "implementationNotes": "Triage 2026-09-08 (e): citation error. The function is named claudeProjectsDirectory (session-capture.ts:13), not defaultProjectsDirectory as the card states. resolveSessionFile at :76 is correctly cited. Substance unchanged: case capture only resolves against ~/.claude/projects.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. Capture cannot reuse harness-owned evidence, which adds manual work to session-case construction.\n\nEvidence: case capture searches only claudeProjectsDirectory; harness transcripts live under .benchmark-runs/sessions; focused capture tests cover only the former.\n\nUnresolved claims/resources: None for the next action.\n\nNext action: Resolve IDs over both stores with explicit ambiguity behavior and retain interactive-session coverage.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "id": "ACT-118",
    "before": {
      "status": "To Do",
      "implementationNotes": "Triage 2026-09-08 (e): citation error. context-manifest.test.ts:149 is an unrelated test; the actual casesRoot() read the card means is at line 227-228. .gitignore line 2 and the session-attempt.ts:173 error message are correctly cited.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: implementation. Priority: medium. Committed prefixed cases are not runnable from a fresh clone without an ignored duplicate.\n\nEvidence: Runtime resolves .benchmark-runs/cases while fixture tests read cases/; focused case/attempt tests confirm missing run-state refusal.\n\nUnresolved claims/resources: None for the next action.\n\nNext action: Make runtime and tests use one declared source, then verify from a clean temporary tree.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "after": {
      "status": "Shape",
      "implementationNotes": "Triage 2026-09-08 (e): citation error. context-manifest.test.ts:149 is an unrelated test; the actual casesRoot() read the card means is at line 227-228. .gitignore line 2 and the session-attempt.ts:173 error message are correctly cited.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. Committed prefixed cases are not runnable from a fresh clone without an ignored duplicate.\n\nEvidence: Runtime resolves .benchmark-runs/cases while fixture tests read cases/; focused case/attempt tests confirm missing run-state refusal.\n\nUnresolved claims/resources: None for the next action.\n\nNext action: Make runtime and tests use one declared source, then verify from a clean temporary tree.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  }
]
```
