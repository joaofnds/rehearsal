---
id: ACT-31
title: make runBenchmark reachable from a test with fake dependencies
status: To Do
assignee: []
created_date: '2026-09-03 03:17'
updated_date: '2026-09-09 16:23'
labels: []
dependencies:
  - ACT-26.7
priority: low
ordinal: 33008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the current runBenchmark orchestration testable with fake collaborators and pin retention before teardown.
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

Priority 2026-09-08: Low to Medium, directed by João, same basis as ACT-27's note of this date. The 'nothing an operator can observe yet' premise is verified false: a real replayable run exists (rehearsal.ts list runs, this session). src/benchmark/run.ts has grown to 1156 lines since the card was written.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: low. runBenchmark production wiring remains untested, but no active behavior failure is recorded.

Evidence: runBenchmark is a 1,166-line production-wired export and has no direct call in run.test.ts.

Unresolved claims/resources: ACT-26.7

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Inject RunDependencies and drive one full no-pause run with fakes.

Record: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
