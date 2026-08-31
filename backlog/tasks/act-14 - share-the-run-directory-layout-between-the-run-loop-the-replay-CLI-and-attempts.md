---
id: ACT-14
title: >-
  share the run-directory layout between the run loop, the replay CLI, and
  attempts
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 21:51'
updated_date: '2026-08-31 14:09'
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
- [x] #1 one module owns every .benchmark-runs path scheme; run.ts, replay-stage.ts, and attempts.ts consume it
- [x] #2 renaming a path scheme in that module breaks a test instead of silently dropping an attempt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built in commits 088ec0f..b8dbed8.

What changed:
- Added run-layout.ts as the sole owner of .benchmark-runs, run/review/stage files, checkpoint directories, manifest files, replay grouping, and timestamp filename normalization.
- run.ts, manifest.ts, replay.ts, replay-stage.ts, and attempts.ts now consume BenchmarkRunPaths instead of reconstructing paths.
- Existing artifact spellings remain byte-for-byte compatible.

What became possible:
- ACT-5 can add confirmation group, rep, and report paths at one boundary. No confirmation paths are wired yet.

Observed:
- The exact layout contract test asserts every path and timestamp spelling.
- loadAttempts tests observed original and replay attempts loaded through one path value, including legacy and lineage-mismatch behavior.
- runReplay tests observed replay records written through the same value, including a real detached-worktree integration test.
- Fresh full suite: 253 pass, 0 fail; typecheck, oxlint, and oxfmt passed.

Not verified:
- No paid replay CLI session was run; CLI wiring is covered through parsing, resolver logic, runReplay, and real-worktree tests.

Review:
- No independent review trigger applies to this behavior-preserving internal refactor; author-side full verification completed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Centralized every benchmark run path scheme without changing recorded-artifact compatibility. Observed exact path contracts, shared original/replay loading, replay record writing, and real-worktree replay behavior. Fresh verification: 253 tests passed; typecheck, lint, and format passed. No paid session was run.
<!-- SECTION:FINAL_SUMMARY:END -->
