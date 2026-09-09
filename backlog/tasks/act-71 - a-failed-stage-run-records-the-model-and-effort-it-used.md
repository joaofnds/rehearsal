---
id: ACT-71
title: a failed stage run records the model and effort it used
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 23:48'
updated_date: '2026-09-09 01:28'
labels: []
milestone: m-3
dependencies: []
type: bug
ordinal: 67008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while preparing ACT-39's paid run on 2026-09-05.

To rerun the audit-log case comparably with the two prior attempts, the session needed to know which model they used. The failed run artifacts do not say. input.model, input.judgeModel, input.effort, and input.judgeEffort are all absent, and the providerCalls entries carry only cost and token metrics, no model name. The answer was only recoverable from ACT-38's note recording the command line by hand.

The passing path already records this. run.ts builds StageJudgeRecord with model, judgeModel, judgeEffort, sessionBudgetUsd, and effort, so a stage that passes keeps them. A stage that fails goes through writeStageJudgeFailure, which keeps status, stage, error and input only.

This is the same shape of gap as ACT-70 and the same fix seam. It matters for comparison specifically: comparison-comparability.ts:171 treats sessionBudgetUsd as a comparability key, so runs whose inputs are unrecorded cannot be checked for comparability at all.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A run whose stage fails judgment records the workflow model, judge model, and both effort settings in the artifact
- [x] #2 Reading a failed run's artifact alone answers 'what model produced this' without consulting the card that launched it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add model, effort, judgeModel, judgeEffort, sessionBudgetUsd to PendingStage in src/benchmark/run-abort.ts.
2. Update writeStageJudgeFailure (and writePendingStage) in src/benchmark/run-abort.ts to write these configuration fields into the stage JSON.
3. In src/benchmark/run.ts:runGradedStages, populate these fields from context when creating pendingStage.
4. Add unit test in src/benchmark/run-abort.test.ts asserting that writeStageJudgeFailure preserves model, judgeModel, effort, judgeEffort, and sessionBudgetUsd.
5. Add test in src/benchmark/run.test.ts asserting that a stage failing judgment retains model and effort fields in the aborted stage artifact.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session that hit this while trying to reproduce ACT-38's run settings. Not urgent on its own, but it is a precondition for trusting any comparison across runs.

Triage 2026-09-07: assigned m-3, same basis as ACT-59/60.

Bet, 2026-09-09: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet: m-3's only open card; closes that milestone to 5/5.

Completed in commit 39bc14e.
Verification:
- src/benchmark/run-abort.test.ts: 'writeStageJudgeFailure > carries the model, judge model, effort settings, and budget into the failed artifact' (AC #1, #2)
- src/benchmark/run.test.ts: 'runGradedStages > records workflow model, judge model, effort settings, and budget in the aborted stage artifact when judgment fails' (AC #1, #2)
- Full test suite passed (1323 unit/cli tests across 85 files).
- oxlint, tsc, and oxfmt all pass clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both ACs verified with unit and integration tests. PendingStage carries model, effort, judgeModel, judgeEffort, and sessionBudgetUsd, which are serialized in writeStageJudgeFailure and writePendingStage. Tested in run-abort.test.ts and run.test.ts; full test suite, oxlint, tsc, and oxfmt all pass clean.
<!-- SECTION:FINAL_SUMMARY:END -->
