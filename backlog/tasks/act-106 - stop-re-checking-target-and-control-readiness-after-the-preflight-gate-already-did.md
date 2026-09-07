---
id: ACT-106
title: >-
  stop re-checking target and control readiness after the preflight gate already
  did
status: To Do
assignee: []
created_date: '2026-09-07 17:58'
labels: []
dependencies: []
ordinal: 102008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A plain run calls assertControlReady and assertSourceReady exactly once
- [ ] #2 A --confirm run calls assertControlReady and assertSourceReady exactly once
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split from ACT-88, deferred there rather than fixed, 2026-09-07.

ACT-88 added a preflight gate (assertPipelinePreflight in
src/benchmark/preflight.ts) that calls assertControlReady/assertSourceReady
before dependencies.execute in run-command.ts. Neither runBenchmark
(src/benchmark/run.ts:847-848) nor confirmRun (src/cli/run-command.ts, the
--confirm path) was changed to consume that result: both still call the same
two functions again moments later, so a plain run does the check twice and a
--confirm run does it three times (preflight, confirmRun, runBenchmark).

Not a correctness defect today: both checks are cheap, idempotent git calls,
and a re-check that finds the state changed between the two calls still
throws its own class of error rather than silently accepting stale state.
It is duplicate I/O the new gate was meant to make redundant and did not.

The fix: assertPipelinePreflight (or a variant of it) returns the
SourceBaseline/controlSha it already computed, and runBenchmark/confirmRun
take that value instead of re-deriving it, rather than the gate returning
void as it does now. This changes runBenchmark's signature in
src/benchmark/run.ts and confirmRun's call graph in src/cli/run-command.ts,
both outside what ACT-88 touched, which is why it was deferred rather than
folded in.
<!-- SECTION:NOTES:END -->
