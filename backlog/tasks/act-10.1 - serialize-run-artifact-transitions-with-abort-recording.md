---
id: ACT-10.1
title: serialize run artifact transitions with abort recording
status: Review
assignee:
  - '@claude'
created_date: '2026-08-31 13:50'
updated_date: '2026-09-01 01:21'
labels: []
dependencies: []
parent_task_id: ACT-10
type: bug
ordinal: 13008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A signal can interleave with normal stage or main-artifact persistence because run orchestration writes files directly while run-abort reads pending state separately. If interruption arrives during AWAITING_STAGE_JUDGE, AWAITING_HUMAN_REVIEW, or COMPLETE persistence, concurrent normal and FAILED writes can leave the terminal status dependent on write completion order. Independent ACT-10 review found this pre-existing correctness defect; ACT-10 extracted but did not introduce it.

Goal: serialize every run artifact transition with abort recording so interruption deterministically leaves the relevant stage and main records failed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A controlled persistence test requests abort while the AWAITING_STAGE_JUDGE write is blocked; after all writes settle, the stage record is STAGE_JUDGE_FAILED.
- [x] #2 A controlled persistence test requests abort while the AWAITING_HUMAN_REVIEW write is blocked; after all writes settle, the main artifact is FAILED.
- [x] #3 A controlled persistence test requests abort while the COMPLETE write is blocked; after all writes settle, the main artifact is FAILED.
- [x] #4 The FAILED artifact produced by interruption during COMPLETE persistence retains the completed calibration evidence.
- [x] #5 A controlled persistence test observes at most one active run artifact transition.
- [x] #6 A controlled persistence test observes that no normal transition starts after abort is requested.
- [x] #7 A controlled persistence test requests abort before a pending write starts and observes the abort path record that pending state.
- [x] #8 A controlled persistence test fails a terminal write, then requests abort and observes the abort path record the retained pending state.
- [x] #9 A controlled persistence test completes a terminal write, then requests abort and observes no rewrite of that terminal record.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: serialize every run artifact transition with abort recording so interruption deterministically leaves the relevant stage and main records failed.

Known system facts (read 2026-09-01):
- `runGradedStages` writes AWAITING_STAGE_JUDGE before reporting the pending stage, clears the pending stage before writing its scorecard, and may then write a calibrated scorecard. Those gaps let abort miss or race each write.
- `runBenchmark` writes AWAITING_HUMAN_REVIEW before reporting the pending artifact and clears it only after writing COMPLETE. Abort can race both writes, and during COMPLETE it currently retains only the earlier awaiting artifact.
- `createRunAbort` owns pending state and abort persistence, but normal writes bypass it. Its first-reason, independent recovery-barrier, single-flight teardown, and repeated-signal behavior already have characterization tests and remain unchanged.
- The task introduces the glossary term "run artifact transition": one persistence operation advancing a run's main or stage record; abort recording is terminal.

Resolved unknowns:
1. Serialization must order behavior, not merely prevent simultaneous writes. Abort latches when requested, waits behind any transition already in flight, writes terminal failure evidence, and refuses later normal transitions. Otherwise an orchestration continuation could enqueue a normal terminal write after abort and recreate the defect.
2. The boundary is per benchmark run and in-process. The run-abort collaborator is already the single owner of that run's pending state and signal handling, so no filesystem lock or cross-process coordinator is required.
3. Pending stage state begins before AWAITING_STAGE_JUDGE persistence and ends only after the final scorecard write succeeds, including the calibrated STOP scorecard. Pending main-artifact state begins before AWAITING_HUMAN_REVIEW persistence; it advances to the COMPLETE candidate before that write and ends only after the write succeeds. A failed terminal write leaves pending state available to abort recording.
4. Persistence remains best-effort across independent stage and main records: failure to write one abort record is reported but does not skip the other, preserving ACT-10's recovery-barrier guarantee.
5. Tests control the persistence boundary with an owned fake writer and deferred writes; they do not mock Bun or depend on filesystem timing. Production persistence still delegates to Bun.write.

Implementation boundary:
- Extend the run-abort collaborator into the owner of normal and abort artifact transitions, backed by one serialized transition tail and an injected persistence operation. Latch abort synchronously before waiting for the tail.
- Replace `trackPendingStage`, `trackPendingArtifact`, and direct stage/main status writes with transition operations that own pending-state timing. Route AWAITING_STAGE_JUDGE, terminal and calibrated stage scorecards, AWAITING_HUMAN_REVIEW, COMPLETE, and lifecycle-attached failure writes through this boundary.
- Keep stage grading and calibration policy in orchestration; the transition owner only orders persistence and enforces terminal abort semantics.

Acceptance observations:
1. Block AWAITING_STAGE_JUDGE persistence in the fake, request abort, release the write, settle every transition, and read STAGE_JUDGE_FAILED as the final stage record; attempting a later scorecard transition cannot replace it.
2. Repeat the controlled interruption for AWAITING_HUMAN_REVIEW and COMPLETE; read FAILED as the final main artifact with the evidence available at interruption.
3. Observe the fake writer never has two active writes; abort sees state before the first pending write begins and after a failed terminal write, while abort after a successful terminal write performs no rewrite.
4. Existing createRunAbort recovery tests remain green, followed by fresh `bun test`, `bun run typecheck`, `bun run lint`, and `bun run fmt:check`.

First test to write: block the fake persistence operation for AWAITING_STAGE_JUDGE, request abort before releasing it, then assert the write order ends in STAGE_JUDGE_FAILED and a subsequent normal stage transition cannot overwrite that record.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build handoff, 2026-09-01

What changed:
- `createRunAbort` now owns an injected run-artifact persistence boundary and serializes every stage, main-artifact, abort, and final-Judge failure transition with an await-based handoff lock.
- Abort latches synchronously, snapshots pending evidence before waiting for an active write, queues terminal FAILED records behind that write, and refuses later normal transitions.
- `runGradedStages` reports pending state before AWAITING_STAGE_JUDGE persistence, keeps STOP stages pending through calibration, and clears state only after the terminal scorecard succeeds.
- `runBenchmark` routes AWAITING_HUMAN_REVIEW and COMPLETE through the same boundary; COMPLETE becomes pending before persistence, so interrupted FAILED records retain calibration.
- Final-Judge validation failures use an injected failed-artifact transition instead of bypassing lifecycle persistence.
- Added the `StageJudgeRecord` domain contract and a controlled persistence Fake covering blocked, failed, and overlapping writes.

Commits:
- 009cf30 fix: serialize pending stage abort writes
- 0c53224 fix: make stage abort terminal
- cbb64cd fix: route stage records through transitions
- 0a38182 fix: serialize pending run artifact aborts
- b9abcf4 fix: preserve interrupted completion evidence
- 8131127 fix: route main artifacts through transitions
- 2bb5872 test: guard pre-write pending stage state
- 9dc4960 fix: serialize final Judge failures

What became possible but is not wired:
- The controlled persistence boundary can drive future artifact-transition tests without filesystem timing. No benchmark-run artifact caller remains on the old direct-write path; confirmation records have separate lifecycles and are outside this task.

Observed:
- TDD red: the first blocked-stage test failed because `writePendingStage` did not exist; caller wiring failed because the controlled persistence map stayed empty; pending-main, COMPLETE, and final-Judge tests each failed at their missing transition operation or bypass.
- Mutation observations: removing successful terminal clearing changed a later abort from COMPLETE to FAILED; clearing in `finally` left AWAITING_HUMAN_REVIEW after a terminal write failure; removing the queue wait raised active writers from one to two; moving pending assignment into the queued stage write left no abort record. Each restored implementation made its focused test green.
- Fresh focused transition run: 37 pass, 0 fail.
- Fresh full suite: 300 pass, 0 fail, 603 assertions. Fresh `bun run typecheck`, `bun run lint`, and `bun run fmt:check` passed.
- Direct observation outside the suite used delayed persistence backed by real Bun file writes, interrupted the pending stage write, then read `{"stageStatus":"STAGE_JUDGE_FAILED","artifactStatus":"FAILED"}` from disk.

Not verified:
- No paid full benchmark or real OS signal exit was run. Signal delivery, cancellation, teardown, and exit-code behavior remains covered through the injected process boundary from ACT-10.

Stopped on:
- Nothing. Refactor pass found no separate small structural change; ACT-13 already tracks splitting the monolithic test file.

Review:
- Independent review is due because this changes interruption safety, terminal evidence ordering, and the core benchmark lifecycle.
<!-- SECTION:NOTES:END -->
