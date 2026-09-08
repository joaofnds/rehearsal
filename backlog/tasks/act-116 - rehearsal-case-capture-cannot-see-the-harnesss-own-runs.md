---
id: ACT-116
title: rehearsal case capture cannot see the harness's own runs
status: To Do
assignee: []
created_date: '2026-09-08 11:23'
updated_date: '2026-09-08 20:41'
labels: []
dependencies: []
priority: medium
ordinal: 112008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`rehearsal case capture <case> --session <id>` resolves the session id only against ~/.claude/projects (defaultProjectsDirectory, src/benchmark/session-capture.ts:14, used by resolveSessionFile at :76). A harness run invokes the provider with --no-session-persistence (src/benchmark/claude.ts:58), so it writes nothing to that directory. The transcript it produces lands under .benchmark-runs/sessions/<case>/<session-id>/transcript.jsonl instead.

The consequence: the capture verb cannot capture a session the harness itself just ran. Observed 2026-09-08 while building the manifest-probe fixture for ACT-59: `case capture manifest-probe --session a0491c04 --cut 24` returned 'Session prefix a0491c04 matches no session file' for a session that had completed seconds earlier and whose transcript was on disk. The fixture was placed and its sha256 declared by hand.

Capturing an interactive session from ~/.claude/projects still works and is presumably the original intent, so this is a gap in what the verb reaches, not a break in what it does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 case capture resolves a session id against transcripts the harness wrote under .benchmark-runs/sessions, shown by capturing a case's own completed run
- [ ] #2 Capturing from ~/.claude/projects keeps working, shown by an existing test over that directory
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-08 (e): citation error. The function is named claudeProjectsDirectory (session-capture.ts:13), not defaultProjectsDirectory as the card states. resolveSessionFile at :76 is correctly cited. Substance unchanged: case capture only resolves against ~/.claude/projects.
<!-- SECTION:NOTES:END -->
