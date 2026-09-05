---
id: ACT-85
title: list checkpoints prints raw ENOENT for an empty checkpoint stage directory
status: To Do
assignee: []
created_date: '2026-09-05 22:43'
labels: []
dependencies: []
ordinal: 81008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Same defect class as ACT-40, one lister over: listCheckpoints in src/cli/list-command.ts calls Bun.file(checkpointRecordFile(...)).text() with no existence check, so a checkpoint stage directory holding no checkpoint.json throws a raw ENOENT that reaches the operator verbatim, the same way listAttempts did before ACT-40. Found while building ACT-40's redaction test: a synthetic empty stage directory (via a new writeEmptyCheckpointDirectory fixture) reproduced it directly; not yet confirmed against a real checkout. Fix shape is the same as ACT-40's: check existence first, throw a plain 'incomplete' reason routed through collect's existing unreadable path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rehearsal list checkpoints on a checkout holding a checkpoint stage directory with no checkpoint.json prints no raw ENOENT
- [ ] #2 the missing-checkpoint case is reported as incomplete through the existing unreadable-record path, matching ACT-40's decision for attempts
<!-- AC:END -->
