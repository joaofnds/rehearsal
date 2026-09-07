---
id: ACT-102
title: record median and range for a confirmation group's grades
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
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
