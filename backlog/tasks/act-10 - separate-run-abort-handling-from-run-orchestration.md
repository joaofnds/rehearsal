---
id: ACT-10
title: separate run abort handling from run orchestration
status: To Do
assignee: []
created_date: '2026-08-30 17:54'
labels: []
dependencies: []
ordinal: 2008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-9 extracted buildRunArtifact out of runBenchmark, which made the rest of that function's size visible: runBenchmark is about 253 lines in a 594-line src/benchmark/run.ts.

## What the task exposed

runBenchmark holds two unrelated reasons to change in one function:

1. Benchmark orchestration: load the pipeline, check control and source, claim the target, run the graded stages, run the final Judge, assemble and write the artifact, collect calibration.
2. Process lifecycle: markAborted, teardown, restoreOnSignal, releaseSignalHandlers, and the mutable pendingArtifact/pendingStage/abortRecorded/teardownStarted/aborting state those close over. Roughly 60 lines registering SIGINT/SIGTERM/SIGHUP handlers, writing a STAGE_JUDGE_FAILED stage file, and rewriting the run artifact with status FAILED.

The second is why runBenchmark cannot be tested. Its only test today (\"rejects a malformed pipeline before claiming the target\") exercises the path that returns before any of the lifecycle code runs. Everything after claimTarget is unreachable under test because it calls real Claude sessions, so the abort path, the FAILED artifact rewrite, and the signal handlers have no coverage at all.

## Target structure

A run-abort collaborator owning the pending state and the signal registration, taking the run files and the teardown as its dependencies and exposing markAborted/teardown/release. runBenchmark constructs it and reports pending state into it; it stops holding five mutable variables for a concern that is not its own. That collaborator is testable without a Claude session: give it a temporary directory and a fake teardown, tell it a stage is pending, mark it aborted, and read the two files it wrote.

## Cost of leaving it

The abort path is the harness's only guarantee that an interrupted run leaves a readable record and a restored target. It is untested and it is where ACT-2's checkpoint work has to land, since that work needs a record written at every stage transition rather than only after the final Judge. ACT-9's shaping notes named this: a run that fails before the final Judge writes no artifact at all, and fixing that is a change to when the artifact is first written.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The abort path writes its stage file and its FAILED artifact under test, without a Claude session
- [ ] #2 Signal registration and release are exercised by a test rather than only by a real interrupt
- [ ] #3 runBenchmark no longer holds the pending-run mutable state
<!-- AC:END -->
