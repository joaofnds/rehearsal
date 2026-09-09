---
id: ACT-102
title: record median and range for a confirmation group's grades
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-7
dependencies:
  - ACT-49
references:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: low
ordinal: 98008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's run history groups row reads '6 of 6 recorded, median B, range D to A', and the comparisons arm cards show 'median of 6 · range C+ - A-'. confirmation-report.ts's ReliabilitySummary carries gradeDistribution (a record of grade to count), successRate, standardError, and passK, but no median grade and no min/max range. A median and range are computable from gradeDistribution but nothing computes or stores them today. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A confirmation group's reliability summary carries a median grade and a min-max range alongside its existing grade distribution
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

Session benchmark scope accepted 2026-09-09 (doc-59): ACT-146 adds named deterministic-check results and partial-score comparisons for session cases, including a single-case experiment. Coordinate distribution presentation with it; this card's current letter-grade median/range criterion does not by itself express a score such as 18/19.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: implementation. Priority: low. Median and range make comparison-arm summaries scannable and are already derivable from the complete grade distribution.

Evidence: confirmation-report.ts and comparison-record.ts carry gradeDistribution but no median/range; focused confirmation tests pass.

Unresolved claims/resources: None for the next action.

Next action: Compute median and extrema at the report/presentation boundary and coordinate partial-score labels with ACT-146.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
