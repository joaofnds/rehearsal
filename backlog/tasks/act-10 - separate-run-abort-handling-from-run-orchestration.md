---
id: ACT-10
title: separate run abort handling from run orchestration
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 17:54'
updated_date: '2026-08-31 13:51'
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
- [x] #1 The abort path writes its stage file and its FAILED artifact under test, without a Claude session
- [x] #2 Signal registration and release are exercised by a test rather than only by a real interrupt
- [x] #3 runBenchmark no longer holds the pending-run mutable state
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built in commits cab4d05..58344e1.

What changed:
- Added run-abort.ts as the owner of pending stage/artifact state, single-flight abort recording, single-flight teardown, signal subscriptions, command cancellation, restoration, and signal exit codes.
- Moved stage-failure and run-artifact persistence into that boundary.
- runBenchmark now reports pending state and delegates abort, teardown, and signal release; stageFailureCalibrated remains orchestration policy.

What became possible:
- A future worktree-scoped full-pipeline rep can reuse orchestration without inheriting process-global pending state. That extraction is not wired yet and remains ACT-5 work.

Observed:
- Focused createRunAbort tests directly recorded pending stage and FAILED run artifacts without Claude, registered/released matching signal handlers, and drove SIGTERM through cancellation, evidence recording, teardown, and exit code 143.
- Fresh full suite: 247 pass, 0 fail. Fresh typecheck and oxlint passed; oxfmt passed after formatting.

Not observed:
- No real OS signal was sent because the behavior exits the harness process and restores a target; the injected process boundary was observed instead.

Review:
- Independent review is due because this changes interruption and target-restoration safety.

Independent review, 2026-08-31
--------------------------------
Reviewed materialized patch cab4d05^..58344e1 across style, architecture, spec, security, testing, and refactoring; every changed file was examined.

Findings and dispositions:
1. [correctness, pre-existing, TRACKED ACT-10.1] Normal stage/final artifact writes and signal abort writes are not serialized, so an interrupt during a write can leave terminal status dependent on completion order. The extraction did not introduce the race; a dedicated bug card records controlled-write acceptance and the required shared transition boundary.
2. [correctness, blocking, FIXED bf0192b] A failed command sweep skipped evidence and teardown, and a failed stage-evidence write skipped the valid main-artifact write. Recovery steps now have independent barriers; focused tests observed evidence and teardown after cancellation failure and a FAILED main artifact after stage-write failure.
3. [testing, should-fix, FIXED 5722edd] Single-flight guards had no regression protection. Characterization tests now observe first-reason persistence, one teardown for overlapping callers, and one cancellation/teardown/exit for repeated signals.

No findings under style, spec, security, or refactoring.

Post-fix verification: fresh bun test reported 252 pass, 0 fail; bun run typecheck, bun run lint, and bun run fmt:check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extracted and independently reviewed run abort lifecycle. Fixed recovery barriers so cancellation or one evidence-write failure cannot skip remaining recovery, and guarded single-flight behavior. Fresh verification: 252 tests passed; typecheck, lint, and format passed. The pre-existing normal-write/abort-write race is tracked as ACT-10.1. Real process exit was not invoked; the injected boundary was observed.
<!-- SECTION:FINAL_SUMMARY:END -->
