---
id: ACT-106
title: >-
  stop re-checking target and control readiness after the preflight gate already
  did
status: To Do
assignee: []
created_date: '2026-09-07 17:58'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: low
ordinal: 102008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reuse the source and control baseline established by preflight so plain and confirmation runs do not repeat readiness checks.
<!-- SECTION:DESCRIPTION:END -->

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

Triage 2026-09-08 (e): citation drift only. assertControlReady/assertSourceReady calls in runBenchmark are at run.ts:857-858 now, not wherever the card implied. Substance confirmed live: assertPipelinePreflight runs at run-command.ts:148, runBenchmark re-checks again at run.ts:857-858, and confirmRun re-checks a third time at run-command.ts:328-329.

Low because the defect is duplicated work with no wrong outcome: readiness is asserted twice and both assertions agree. Its criteria are cheap and observable, counting the calls on a plain run and a --confirm run, so it is a good companion for any sitting already inside the preflight path, which is where ACT-121 also lands.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: low. Passing the preflight baseline forward removes redundant git I/O with a small, observable change.

Evidence: run-command preflight calls both readiness checks; runBenchmark calls both again; confirmRun has another pair.

Unresolved claims/resources: None for the next action.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Return the checked source/control baseline from preflight, pass it through both paths, and assert exact call counts.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
