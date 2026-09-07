---
id: ACT-49
title: name what the design shows that the harness cannot yet supply
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-07 16:33'
labels: []
milestone: m-5
dependencies:
  - ACT-47
priority: high
ordinal: 51008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The prototype presents data the harness does not record today. Until that gap is written down, every screen card is guessing at how much backend work it carries.

Observed on the run history screen, 2026-09-04:

- **A live run.** The top row reads "running, step 3 of 4" with a spend bar counting against a ceiling and a wall clock. Nothing streams today: the CLI writes a record when a stage finishes, and ACT-26.7 records that harness progress goes to stdout as prose. There is no event stream, no partial state on disk, and no way to read a run in flight.
- **A per-run cost that includes the judge.** The design shows one cost per run. ACT-43 records that the artifact carries only the workflow session cost and omits the judge entirely.
- **An interrupted run, reconciled.** One row reads "interrupted, spend ceiling reached mid-step 2". The harness has no interrupted outcome and nothing reconciles a partial run on restart. The lost UI had a startup-reconciliation module for exactly this (docs/recovered).
- **Staleness with a distance.** Rows say "stale, corpus changes since" and "superseded, 2 versions back". `rehearsal stale` answers the boolean today; it does not say how many corpus versions back a result sits.
- **A groups row.** One row reads "6 of 6 recorded, median B, range D to A". Confirmation groups exist in the harness; whether the record carries a median and a range in this shape is unverified.
- **Task-level grade separate from step grades.** Each row shows step grades and a task grade, with rows reading "graded independently". The harness has stage judges and a final judge, so this may map cleanly, but the mapping is not confirmed.

The three run-detail layouts (Step rail, Record ledger, Contribution) and the two comparison layouts (Attempt pairs, What moved) were not inspectable, so their data needs are unknown and this card does not claim to cover them.

This card produces the inventory, not the fixes. Each real gap becomes its own card, and the ones that are already cards (ACT-43 for judge cost, ACT-26.7 for the stdout rule) get referenced rather than duplicated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every screen in the committed design is walked, and each piece of data it displays is marked as recorded today, derivable from what is recorded, or not recorded at all
- [x] #2 Each not-recorded item names the card that would supply it, existing or newly filed
- [x] #3 The live-run gap states specifically what a UI would have to read to show a run in progress, since nothing on disk answers that today
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction 2026-09-07, from an adversarial review of the inventory above.

The review found no blocking findings; the inventory's RECORDED/DERIVABLE/GAP calls held up against the actual source for every item it checked, and none of the ten new cards duplicates existing scope or drifts into prescribing a fix. Two should-fix findings, folded:

1. Calibration screen's "per-dimension judge drift... DERIVABLE" was wrong. judge-agreement.ts's stageDecision (line 213) collapses a dimension's letter grade to a binary PASS/FAIL before it reaches JudgeAgreementObservation, so the letter-grade distance a signed "judge +0.7 steps" value needs is already discarded at the point of accumulation. This is a GAP, not a DERIVABLE: producing that figure needs a wider observation than judge-agreement.ts persists today, capturing both grades' letters rather than their reduced PASS/FAIL decision. No new card filed for this alone; it sits with whoever builds the calibration screen's drift column to decide whether widening JudgeAgreementObservation is worth it against the existing agreement/kappa figures that ARE recorded per dimension.

2. ACT-105 corrected in place: durationMs/apiDurationMs are optional fields (contracts.ts:188-189, tracing to the optional duration_ms/duration_api_ms on the provider envelope), so "a sum over providerCalls" could silently undercount a chain with a missing value. Added AC3 requiring the aggregate to mark itself incomplete rather than produce a number indistinguishable from a complete sum.

One wording defect in the inventory itself, not a factual error: the AC disposition line says "done, all nine screens above; screens 6-8, 10-11 stated as already covered by ACT-50's read-existing-data scope" as though those four screens sat outside the nine sections walked. They don't — sections 6 through 9 in the body above are exactly screens 6 through 11 (7/8 and 10/11 share a section each because they're thin and similar). All eleven screens get at least one line of disposition; the sentence just counted sections instead of screens. Restating for a future reader: nine numbered sections above cover all eleven design screens, with two sections each covering a pair.
<!-- SECTION:NOTES:END -->
