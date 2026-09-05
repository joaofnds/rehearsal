---
id: ACT-43
title: >-
  a run's reported total cost omits the workflow sessions, so a run's price is
  understated
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 16:05'
labels:
  - partial
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
- [x] #1 A run record carries the workflow sessions' aggregate cost as a field of its own, not only nested under each stage's input transcript
- [x] #2 A run's reported total cost equals the sum of every provider session the run caused, workflow and judge and product-owner, checked against one real completed run's record
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

Shaped 2026-09-05: no unknowns remain, no survey needed. One fix: record-summary.ts's runSummarySchema and runSummary() (lines 44-85) read only stageScorecards[].costUsd, productOwnerCostUsd, judgeCostUsd. The workflow sessions' cost already exists as an array on the run artifact (RunArtifactEvidence.workflow, run.ts:211, each entry a StageTranscript with its own costUsd, contracts.ts:242-248) but the summary never reads that field. Add workflow cost to the schema and sum it into totalCost. First test: parseRunSummaryRecord + runSummary on a fixture record with a workflow array and a lower stageScorecards-only total, asserting the printed total includes the workflow figure and matches the real completed record's actual total (1.46 vs the current wrong 1.12 on .benchmark-runs/2026-09-05T00-21-40.070Z.shape.json). AC3 needs no new aggregation code: confirmation-report.ts's sumCallMetrics already sums every CallRole (worker, product-owner, stage-judge, final-judge) into resources.total.costUsd (confirmation-report.ts:228-249); AC3 is satisfied by verifying that against one real confirmation group report. No glossary terms needed.

Probe 2026-09-05 by the iterate overseer, confirming the shape. RunArtifactEvidence.workflow is a readonly StageTranscript[] (contracts.ts:425), each entry carrying its own costUsd (contracts.ts:242-248), and record-summary.ts mentions 'workflow' nowhere. So the shape's fix location holds: the number exists on the artifact and the summary never reads it.

One gap the shape did not name. No completed full run artifact exists on disk. .benchmark-runs holds only per-stage judge records (the one I probed, 2026-09-05T00-21-40.070Z.shape.json, has no workflow key because it is a StageJudgeRecord, not a GradedRunArtifact) and the comparisons directory is empty. AC2 asks for the total checked against one real completed run's record, and AC3 against one real confirmation group report. Neither artifact is on disk, so both need a real run produced before they can be checked. Budget that into the build step or expect it to stop there.

Build 2026-09-05. AC1 done: record-summary.ts's runSummarySchema now requires a workflow array (each entry's costUsd), and runSummary sums it into the printed total alongside stage, product-owner, and judge cost. Test-driven: record-summary.test.ts's fixture and expectation were extended first, red for the predicted reason (old total ignored the new field), then green. show-command.test.ts's hardcoded total was corrected to match (7.75 vs the old wrong 4.75). run-records-test-support.ts's fixture, which every list/show test reads, now supplies a workflow array too, since the schema field is required and every real run artifact always carries it (contracts.ts's RunArtifactEvidence.workflow is non-optional).

AC3 needed no new aggregation code, confirmed by reading: confirmation-report.ts's sumCallMetrics, called with no role filter at line 325, sums every call in a rep regardless of its CallRole. Extended the existing buildResourceReport test (confirmation-report.test.ts) to add a product-owner call to one rep and a final-judge call to the other, previously only worker and stage-judge were exercised. The total column summed all four correctly on that run.

Not verified: neither AC2 nor AC3 has been checked against a real completed run's record or a real confirmation group report, as their own wording requires. Checked disk directly: .benchmark-runs holds only per-stage StageJudgeRecord files (*.shape.json), no completed GradedRunArtifact, and .benchmark-runs/comparisons and any group directory are empty. Producing either means running a real pipeline case or confirmation group end to end, real spend under --model sonnet. Left both AC unchecked rather than accept the schema/unit-test evidence as a substitute for what the criteria ask for.

Next action is João's call: run a real case (or point me at one already scheduled) so AC2 and AC3 get their required real-record evidence, or accept the schema-and-unit-test evidence as sufficient and I'll check both off on that basis.

Verified 2026-09-05 by the iterate overseer, independently of the build session. Ran the full check set myself: 1014 tests pass, typecheck clean, oxlint clean, oxfmt clean.

Direct observation of the fix on real data, not a fixture. Fed the real per-stage record's own figures through runSummary (stage judge cost 1.11871, workflow session cost 0.3377274). It printed 'Total cost $1.46' against the $1.12 the old code produced, matching the record's true spend of 1.4564374. The defect this card names is closed in the code.

AC2 and AC3 remain unchecked and are correctly unchecked. Both ask for the check against a real completed run record and a real confirmation group report. Neither artifact exists on disk. Producing them means spending real money on a pipeline run under --model sonnet. That is João's call and the card waits on it.

Real run attempted 2026-09-05 by the iterate overseer, ./rehearsal.ts run --case audit-log --model sonnet --session-budget-usd 3.

The run did not complete. Shape graded B CONTINUE, then the build stage ended in 'Worker execution failed' and the target was restored. The transcript shows the build session spending its turns on a permission detour (git status denied by the harness permission mode) and then on an e2e isolation conflict it took to the Product Owner. No GradedRunArtifact was written, only .benchmark-runs/2026-09-05T02-56-43.136Z.shape.json. So AC2 and AC3 are still unchecked, and this run cost roughly a dollar and a half without producing the artifact they need.

What the run did produce is a second independent confirmation of the fix. On that fresh record the judge cost is 0.749989 and the workflow session cost is 0.7154158. runSummary now prints 'Total cost $1.47' against a true spend of 1.4654048. The pre-fix code would have printed $0.75, understating by half. Two real records now show the same correction, the earlier one 1.12 against 1.46.

Open question for João: the build stage failing is its own defect and may deserve a card. It is not this card's subject.

Closed partial 2026-09-05 at João's direction.

Delivered and verified: a run's reported total cost now includes the workflow sessions. Confirmed twice on real records. On 2026-09-05T00-21-40.070Z.shape.json the summary prints $1.46 where the old code printed $1.12. On 2026-09-05T02-56-43.136Z.shape.json it prints $1.47 where the old code printed $0.75. Full checks pass: 1014 tests, typecheck, oxlint, oxfmt.

Left undone: AC2 and AC3, which require the total checked against a completed run artifact and a real confirmation group report. Neither artifact exists. The audit-log run attempted for this purpose failed in its build stage, which is a defect in the pipeline rather than in this fix. The group report was not attempted because it costs roughly $8 to $10 and the same build defect would likely stop it.

AC2 verified 2026-09-05 against the first completed run artifact this project has produced, .benchmark-runs/2026-09-05T15-45-27.760Z.json, status AWAITING_HUMAN_REVIEW.

runSummary reports 'Total cost $12.43'. Summing each session category once, independently: workflow sessions 10.090248, stage judges 1.706542, product owner 0.008400, final judge 0.628065, total 12.433255. The reported figure equals the sum of every provider session the run caused.

Without the fix this record would have reported $3.28, the judge and product-owner spend alone, understating a twelve dollar run by 74 percent. The workflow sessions are the overwhelming majority of a real run's cost, which is what made this defect worth fixing.

AC3 stays unchecked. It needs a confirmation group report, which no run has produced.
<!-- SECTION:NOTES:END -->
