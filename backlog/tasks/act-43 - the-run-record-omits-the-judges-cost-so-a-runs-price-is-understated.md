---
id: ACT-43
title: >-
  a run's reported total cost omits the workflow sessions, so a run's price is
  understated
status: To Do
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 02:47'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 45008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A single run's reported total cost counts only judge and product-owner sessions. The workflow sessions, which are the largest part of a run's spend, are in no total.

Verified 2026-09-05 against the one completed graded record on disk, .benchmark-runs/2026-09-05T00-21-40.070Z.shape.json. Its top-level costUsd is 1.11871, exactly the sum of its two judge attempts (0.551905 + 0.566805). The workflow session's 0.3377274 sits nested at input.transcript.costUsd and reaches no total. A StageScorecard's costUsd is judge-only, not stage-total.

record-summary.ts:80 builds the operator-facing figure by summing stageScorecards[].costUsd, productOwnerCostUsd and judgeCostUsd, then prints it as 'Total cost'. All three are judge or product-owner figures. On that record the printed stage cost is 1.12 against a real stage spend of 1.46, about 23 percent low, and the gap grows with the workflow's share of the run.

The run artifact has no field for the workflow sessions' aggregate cost at all (run.ts:200-222). The per-stage number exists only nested under input.transcript.

Scope note: the confirmation-group path is already correct. collectConfirmationMetrics in confirmation-evidence.ts:274 collects worker, product-owner, stage-judge and final-judge calls, and confirmation-report.ts sums all four roles into resources.total.costUsd. Criterion 3 needs verification against a real group report rather than new aggregation code.

Reproduce by loading a completed run record as JSON, summing every nested costUsd, and comparing that against the 'Total cost' the run summary prints.

This card previously described the defect backwards, naming the judge as the omitted session. Judge cost is the part that is recorded. The correction and its probe are in the implementation notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run record carries the workflow sessions' aggregate cost as a field of its own, not only nested under each stage's input transcript
- [ ] #2 A run's reported total cost equals the sum of every provider session the run caused, workflow and judge and product-owner, checked against one real completed run's record
- [ ] #3 A confirmation group's projected cost accounts for every session role, verified against one real group report rather than assumed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, moved to m-1. It was on m-3 as evidence hygiene. The design makes it visible: SPEC.md shows the judge as 'independent session · $0.08' in the judge pane, so the omission becomes a number the operator reads rather than a field a record lacks. It also belongs with proving the loop, since a comparison that understates cost cannot answer whether an edit was worth its price.

Probe 2026-09-05 by the iterate overseer, refuting the shape session's conclusion. The shape session concluded judge cost is already threaded through and that the card's evidence was only a failed run. That is wrong, and the mistake is inverted from the card's title.

Checked the one completed graded record on disk, .benchmark-runs/2026-09-05T00-21-40.070Z.shape.json. Its top-level costUsd is 1.11871, which equals the sum of its two judge attempts exactly. The workflow session's 0.3377274 sits at input.transcript.costUsd and is in no total. So a StageScorecard's costUsd is judge-only, not stage-total.

record-summary.ts:80 sums stageScorecards[].costUsd, productOwnerCostUsd and judgeCostUsd and prints it as 'Total cost'. Every one of those three is a judge or product-owner figure. The workflow sessions, the most expensive part of a run, are absent from the operator-facing total. On this record the printed stage cost would be 1.12 against a real stage spend of 1.46.

The run artifact has no field for the workflow sessions' aggregate cost at all (run.ts:200-222). The per-stage number exists only nested under input.transcript.

So the card stands, its acceptance criteria stand, and the defect is the reverse of how the description frames it: judge cost is the part that IS recorded, and the workflow cost is what the totals drop.
<!-- SECTION:NOTES:END -->
