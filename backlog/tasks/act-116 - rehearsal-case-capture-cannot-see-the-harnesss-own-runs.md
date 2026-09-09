---
id: ACT-116
title: rehearsal case capture cannot see the harness's own runs
status: To Do
assignee: []
created_date: '2026-09-08 11:23'
updated_date: '2026-09-09 16:21'
labels: []
milestone: m-3
dependencies: []
priority: medium
ordinal: 112008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let case capture find completed harness session transcripts as well as interactive Claude project sessions; session attempts do persist transcripts, so remove the overbroad no-session-persistence rationale.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 case capture resolves a session id against transcripts the harness wrote under .benchmark-runs/sessions, shown by capturing a case's own completed run
- [ ] #2 Capturing from ~/.claude/projects keeps working, shown by an existing test over that directory
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-08 (e): citation error. The function is named claudeProjectsDirectory (session-capture.ts:13), not defaultProjectsDirectory as the card states. resolveSessionFile at :76 is correctly cited. Substance unchanged: case capture only resolves against ~/.claude/projects.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: implementation. Priority: medium. Capture cannot reuse harness-owned evidence, which adds manual work to session-case construction.

Evidence: case capture searches only claudeProjectsDirectory; harness transcripts live under .benchmark-runs/sessions; focused capture tests cover only the former.

Unresolved claims/resources: None for the next action.

Next action: Resolve IDs over both stores with explicit ambiguity behavior and retain interactive-session coverage.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
