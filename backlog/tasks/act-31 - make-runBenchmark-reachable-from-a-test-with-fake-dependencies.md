---
id: ACT-31
title: make runBenchmark reachable from a test with fake dependencies
status: To Do
assignee: []
created_date: '2026-09-03 03:17'
updated_date: '2026-09-03 11:55'
labels: []
dependencies:
  - ACT-26.7
ordinal: 33008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
runBenchmark is a 292-line procedure in src/benchmark/run.ts that constructs every collaborator it uses: assertControlReady, assertSourceReady, captureWorkflowBackup, claimTarget, createProductOwner, runWorkflowStage, runStageJudge, runJudge, createRunAbort, teardownTarget. Nothing can call it without a real target repository and a provider, so it has no test.

ACT-26.3 met three of its acceptance criteria by extracting the decisions it needed to observe (finishGradedRun, pausesOnFailure, and the calibrateStageFailure hook) rather than by testing the run. That worked, but it means the wiring between those decisions is still unobserved: nothing checks that finishGradedRun is called with the artifact's own resultSha, or that the teardown really follows the retention ref.

runGradedStages next door takes a StageDependencies record and is fully faked in run.test.ts. The target structure is the same shape one level up: a RunDependencies record runBenchmark takes, with rehearsal.ts supplying the real ones, so a test can run the whole benchmark over fakes and observe the order of claim, grade, retain, restore.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 runBenchmark takes its collaborators as a dependencies record, and a test drives a whole run over fakes with no target repository and no provider call
- [ ] #2 A test asserts the no-pause run's order: the retention ref is recorded with the artifact's resultSha before teardownTarget runs
- [ ] #3 The existing runGradedStages, finishGradedRun, and pausesOnFailure tests keep passing unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: depends on ACT-26.7, verified against the code rather than assumed. Eight of the fourteen `console.log` sites in src/benchmark/ sit inside run.ts's runBenchmark (lines 849-851, 947, 1016-1031, 1080), which is the function this card converts to a RunDependencies record. ACT-26.7's acceptance #5 requires every one of them to reach the caller through an injected writer, which is a parameter on that same record. Doing this card first means ACT-26.7 re-edits the record it just introduced; doing ACT-26.7 first means the writer is one more collaborator this card moves into the record with the rest.
<!-- SECTION:NOTES:END -->
