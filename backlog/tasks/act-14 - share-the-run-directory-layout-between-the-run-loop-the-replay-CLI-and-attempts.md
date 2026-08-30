---
id: ACT-14
title: >-
  share the run-directory layout between the run loop, the replay CLI, and
  attempts
status: To Do
assignee: []
created_date: '2026-08-30 21:51'
labels: []
dependencies: []
ordinal: 6008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-3 review finding (data coupling, should-fix). Three files each hard-code pieces of the .benchmark-runs layout: src/benchmark/run.ts createRunFiles builds '.benchmark-runs', '<name>.checkpoints', and '<name>.<stage>.json'; replay-stage.ts resolveRunDirectory rebuilds '<name>.checkpoints'; src/benchmark/attempts.ts rebuilds '<name>.<stage>.json' and 'replays/<lineage>'. Divergence fails silently: rename the stage-file scheme in createRunFiles and loadOriginalAttempt returns undefined, so the original attempt vanishes from the side-by-side with no error. Fix: export the layout path builders from one module (manifest.ts or a small layout module) and consume them in the other two. The recorded ACT-3 deferral covers only checkpoint-dir-equals-stage-name in two places, not this wider contract. Verify with the existing loadAttempts and replay CLI tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 one module owns every .benchmark-runs path scheme; run.ts, replay-stage.ts, and attempts.ts consume it
- [ ] #2 renaming a path scheme in that module breaks a test instead of silently dropping an attempt
<!-- AC:END -->
