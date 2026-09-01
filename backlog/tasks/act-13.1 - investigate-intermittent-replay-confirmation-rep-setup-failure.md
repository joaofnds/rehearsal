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
<!-- SECTION:NOTES:END -->
