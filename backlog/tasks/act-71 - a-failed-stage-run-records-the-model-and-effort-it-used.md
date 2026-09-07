---
id: ACT-71
title: a failed stage run records the model and effort it used
status: To Do
assignee: []
created_date: '2026-09-04 23:48'
updated_date: '2026-09-07 10:44'
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
- [ ] #1 A run whose stage fails judgment records the workflow model, judge model, and both effort settings in the artifact
- [ ] #2 Reading a failed run's artifact alone answers 'what model produced this' without consulting the card that launched it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session that hit this while trying to reproduce ACT-38's run settings. Not urgent on its own, but it is a precondition for trusting any comparison across runs.

Triage 2026-09-07: assigned m-3, same basis as ACT-59/60.
<!-- SECTION:NOTES:END -->
