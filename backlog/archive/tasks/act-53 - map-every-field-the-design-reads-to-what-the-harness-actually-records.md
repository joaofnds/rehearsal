---
id: ACT-53
title: map every field the design reads to what the harness actually records
status: To Do
assignee: []
created_date: '2026-09-04 13:06'
updated_date: '2026-09-04 13:07'
labels: []
milestone: m-1
dependencies:
  - ACT-47
priority: high
ordinal: 55008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/design-handoff/SPEC.md specifies nine screens whose data comes "all from disk". Some of it the harness records today. Some of it does not exist. Building a screen against a field that is not recorded produces a UI that lies, which is the one failure this whole tool exists to prevent.

Known gaps, from reading the spec against the code on 2026-09-04. Not exhaustive, which is what this card is for:

- Live run state (elapsed, spend so far, burn rate, tokens in/out, current tool call, per-step status as it changes). The harness writes a record when a stage ends. Nothing streams. The spec`s most-designed screen, the live monitor, reads almost entirely from data that does not exist.
- Judge cost per step. The record omits it entirely (ACT-43).
- Task-level grade, graded from first input and last artifact only. The harness grades stages and has a final judge; whether that is the same thing needs checking, not assuming.
- Checkpoint ids surfaced per step (`ckpt-0148-s1`). Checkpoints exist; the id format the design shows does not.
- Per-file read manifest per run: which instruction files a step loaded, with role (project instructions / step skill / judge rubric / read for context) and hash. Corpus files with hashes are recorded; the role classification is not.
- Contribution phrases per step ("brief the later steps read", "named 2 files to touch").
- Culprit analysis: an agent reading recorded steps and naming a probable cause, with its own cost and provenance. Does not exist in any form.
- Calibration agreement per dimension ("judge +0.7 steps"). Judge-vs-human agreement accumulates (ACT-7, Done); the per-dimension drift figure needs checking.
- Word counts per attempt, shown beside cost in comparisons.
- Wall-clock per run and per step.

Produce one table: field the design shows, screen it appears on, where it comes from today, and one of RECORDED / DERIVABLE / NOT RECORDED. For each NOT RECORDED, say whether the UI can honestly omit it or whether the harness has to start recording it, and file the harness work as its own card.

Do not build any screen before this table exists. The spec`s own product rule is that every number names the corpus version that produced it; a screen showing a number the harness never recorded breaks that rule at the root.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every data field named in SPEC.md is listed with its screen and one of RECORDED, DERIVABLE, or NOT RECORDED, checked against src/ rather than assumed
- [ ] #2 Each NOT RECORDED field is marked either omit-from-v1 or needs-harness-work, with the reason
- [ ] #3 Every needs-harness-work field has a card on the board
- [ ] #4 The table is committed as a document, not left on the card
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
