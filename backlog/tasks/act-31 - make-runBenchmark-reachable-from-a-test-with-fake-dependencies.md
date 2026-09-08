---
id: ACT-31
title: make runBenchmark reachable from a test with fake dependencies
status: To Do
assignee: []
created_date: '2026-09-03 03:17'
updated_date: '2026-09-08 16:51'
labels: []
dependencies:
  - ACT-26.7
priority: low
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
Triage 2026-09-04, ranked against the project's goal. Stays Low, and deliberately unassigned to a milestone.

The tool has never run its own pipeline (`rehearsal list runs` empty at 540ba9a). Until m-1 produces a comparison somebody reads, internal restructuring changes nothing an operator can observe. These three are the last work to do, not the next.

One exception worth watching: ACT-26.7 becomes real the moment anything consumes `run --json` programmatically, because harness prose on stdout makes the record unparseable. If m-1's run is driven by hand and read by eye, that does not bite. If it is scripted, ACT-26.7 blocks it and should be pulled forward.

Triage 2026-09-08 (d): same stale premise as ACT-27, see that card's note of the same date. A real recorded run now exists (rehearsal.ts list runs, verified 2026-09-08), so the 'nothing an operator can observe yet' reasoning both cards were deprioritized on no longer holds as stated. Priority is João's call, flagged in this run's triage doc rather than changed here.
<!-- SECTION:NOTES:END -->
