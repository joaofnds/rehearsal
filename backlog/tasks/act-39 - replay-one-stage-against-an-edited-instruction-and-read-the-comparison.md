---
id: ACT-39
title: replay one stage against an edited instruction and read the comparison
status: To Do
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-04 23:04'
labels: []
milestone: m-1
dependencies:
  - ACT-38
  - ACT-41
priority: high
ordinal: 41008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The loop the tool exists for, run once: take a checkpoint ACT-38 recorded, change one instruction in the corpus, replay that one stage against the changed corpus, and read the comparison between the two attempts.

This is the inner loop from docs/vision.md and the reason the project exists. Every piece is built (replay, lineage, staleness, comparison reporting) and none has carried a real corpus edit.

Pick an edit whose effect is arguable rather than obvious, so the comparison has to do work. What matters is whether the operator can answer 'did that edit help' from what the tool prints, without reading the raw transcripts.

Depends on ACT-38: there is no checkpoint to replay until a run has recorded one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One stage is replayed from an ACT-38 checkpoint against a corpus with exactly one instruction file changed
- [ ] #2 `rehearsal stale` reports the checkpoints that edit invalidated, before the replay runs
- [ ] #3 `rehearsal compare` produces a report over the two attempts, and its path is recorded on this card
- [ ] #4 The question 'did that edit improve the stage' is answered on this card from the comparison's own output, with the sentence that answered it quoted, or recorded as unanswerable with what was missing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bet, 2026-09-04: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Oversight probes, 2026-09-05 (iterate session). Both of the shape agent's blocking claims were checked directly and both hold.

No stage checkpoint exists. Both recorded runs' checkpoint directories contain only `initial`; neither holds a shape checkpoint. Both runs ended `STAGE_JUDGE_FAILED`. So acceptance criterion #1 is not reachable today: there is nothing to replay a stage from.

Correction to the stage's cost figure: the two failed attempts cost 0.4304 and 0.5278 USD, 0.958 USD together, not 0.43. The stage quoted one run's cost as if it were both.

`compare` cannot produce a report over two attempts. The report schema in src/benchmark/comparison-record.ts requires cases min 2 (line 311), reps min 2 (line 310), caseDeltas min 2 (line 170), and comparison-loader.ts loads three arms per case with control mandatory (lines 314-326). Acceptance criterion #3 as written cannot be satisfied by a replay pair; it needs a second benchmark case and full confirmation groups.

Card left in To Do pending João's two calls.
<!-- SECTION:NOTES:END -->
