---
id: ACT-13.1
title: investigate intermittent replay confirmation rep setup failure
status: Shape
assignee: []
created_date: '2026-09-01 12:33'
labels: []
dependencies: []
parent_task_id: ACT-13
type: bug
ordinal: 17008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During ACT-13 verification, `bun test src/benchmark/replay-confirmation.test.ts` failed once because confirmation rep 1 never reached the workflow callback while rep 3 did. The same focused suite passed immediately before, and the failure did not recur in 230 isolated repetitions. Confirm the pre-stage failure cause before changing production or test behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A failing run captures the rep record error and the boundary operation that rejected before the workflow callback.
- [ ] #2 The confirmed cause can be switched on and off with materially different failure rates, and every observed rep outcome fits it.
- [ ] #3 The resulting fix task names a deterministic regression observation; if the failure remains unreproducible, the card records the exhausted probes and next discriminating options.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reproduction: run `bun test src/benchmark/replay-confirmation.test.ts -t "cleans completed Judge outcomes"` repeatedly and retain the failed rep records before fixture cleanup. Distinguish concurrent `git worktree add` rejection from later worktree preparation by capturing the diagnostic record error and the worktree-created state. Do not fix until one cause is switchable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed once on 2026-09-01 during the 31-file isolation sweep: `finished` was `[3]` instead of `[1, 3]`. A failure-only `ACT13_DEBUG` probe was then run for 230 isolated repetitions without recurrence and removed; no probe remains. The subsequent isolation sweep and full 354-test suite passed.

Debug follow-up 2026-09-01:
- The exact focused reproduction, `bun test src/benchmark/replay-confirmation.test.ts -t "cleans completed Judge outcomes"`, passed with 1 pass, 0 failures, and 6 expectations.
- Another 100 complete `src/benchmark/replay-confirmation.test.ts` runs passed, preserving the neighboring-test and three-rep concurrency context. Together with the earlier focused probe, 330 subsequent runs have not reproduced the symptom.
- The observed `[3]` outcome constrains the missing rep to failure before `runWorkflowStage`: rep 2 reached that callback and released the test latch, rep 3 then finished, and rep 1 did not. It does not distinguish `addWorktree` from checkpoint materialization, instruction installation, corpus installation, or baseline capture. No cause can therefore be switched on and off from current evidence.
- No production or test behavior changed, and no debug probe remains.

Next discriminating options if the failure recurs:
1. Before fixture cleanup, retain the failed rep record and inspect its `error` plus whether its recorded `worktreePath` exists and appears in `git worktree list --porcelain`. Absence selects `addWorktree`; presence selects later preparation.
2. Add one failure-only probe, prefixed `ACT13_DEBUG`, that tracks the last completed boundary among `addWorktree`, `materializeCheckpoint`, `installInstructions`, `installStageCorpusSnapshot`, `captureFileHashes`, and `captureBaselineContext`; remove it after capturing the rejection.
3. Once one boundary is named, inject that exact rejection at the dependency seam as the deterministic regression observation, then vary only the suspected contention or input to establish materially different failure rates before shaping a fix.
<!-- SECTION:NOTES:END -->
