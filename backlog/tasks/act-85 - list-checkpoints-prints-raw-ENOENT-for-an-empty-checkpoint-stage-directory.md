---
id: ACT-85
title: list checkpoints prints raw ENOENT for an empty checkpoint stage directory
status: Review
assignee: []
created_date: '2026-09-05 22:43'
updated_date: '2026-09-05 23:01'
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
- [x] #1 rehearsal list checkpoints on a checkout holding a checkpoint stage directory with no checkpoint.json prints no raw ENOENT
- [x] #2 the missing-checkpoint case is reported as incomplete through the existing unreadable-record path, matching ACT-40's decision for attempts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed on a real checkout, not only the fixture. A scratch stage directory with no checkpoint.json under .benchmark-runs printed "ENOENT: no such file or directory, open '.benchmark-runs/act85-probe.checkpoints/zz-empty/checkpoint.json'" before the fix and "incomplete: no checkpoint.json recorded" after it. The scratch directory was removed.

The redaction test ACT-40 added had to change source. It used the empty checkpoint directory to produce a reason carrying a path, and this fix removes that path. It now uses a run missing its manifest. Breaking controlRelative deliberately still fails it, so ACT-40's coverage survived.

Of the two new tests, only the incomplete-reason one fails without the fix. The other pins collect's existing contract that one unreadable record does not hide the valid ones.

Full suite, typecheck, lint, and format all pass under the pinned bun 1.4.0.
<!-- SECTION:NOTES:END -->
