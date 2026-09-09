---
id: ACT-149
title: carry session elapsed time into comparison reports
status: To Do
assignee: []
created_date: '2026-09-09 15:49'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-3
dependencies:
  - ACT-146
references:
  - src/benchmark/session-record.ts
  - src/benchmark/comparison-resources.ts
  - src/benchmark/confirmation-report.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 145008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Session attempts already record elapsedMs, and confirmation resource reporting retains rep durations, but comparison resource summaries omit elapsed time. Surface total attempt elapsed time alongside cost and quality so a slower variant remains visible even when its token cost is similar.

ACT-105 covers provider-duration totals for steps/runs. Reuse its vocabulary where applicable, but total attempt elapsed time includes work outside provider calls and is not their sum. Preserve the difference between per-attempt elapsed time and a parallel group's makespan. Integrate with session comparisons and retain explicit missing-duration semantics for older evidence. First verification target: arms with identical cost and different elapsed durations, plus a record missing elapsed evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session comparison reports per-attempt elapsed observations and an arm-level summary alongside cost and quality (João’s approved session benchmark scope, doc-59)
- [ ] #2 A comparison shows the elapsed-time difference between arms with equal cost and different durations (João’s approved session benchmark scope, doc-59)
- [ ] #3 The report distinguishes total attempt elapsed time, provider duration and parallel group makespan rather than summing concurrent attempts into wall-clock time (João’s approved session benchmark scope, doc-59)
- [ ] #4 Missing elapsed evidence remains visible as unavailable or incomplete rather than becoming zero (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. Elapsed time distinguishes equally priced variants in the approved experiment; delay is affordable until session comparisons exist.

Evidence: HEAD 3438d1f (product code unchanged from 1d02c8e). sessionAttemptRecordSchema and runSessionDebugAttempt record elapsedMs; comparison-resources.ts ResourceMetricSummary and ResourceMetricEstimates omit it; confirmation-report.ts retains rep durations.

Unresolved claims/resources: Implementation waits on ACT-146 session comparison contract.

Next action: After ACT-146, shape per-attempt elapsed summaries and contrasts, separating provider duration from parallel makespan.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
