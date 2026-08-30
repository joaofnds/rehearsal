---
id: ACT-7
title: accumulate judge-vs-human agreement from calibration
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies: []
references:
  - docs/design.md
  - docs/research.md
ordinal: 7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Calibration findings (CAUGHT, MISSED, FALSE_POSITIVE) are human labels of Judge decisions. Accumulate them per rubric across runs into a running judge-vs-human agreement figure, shown in reports, and re-baselined whenever the judge model changes. This measures judge drift instead of suspecting it. See docs/design.md decision 8; evidence in docs/research.md 'Judge reliability'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every calibration finding is accumulated per rubric across runs, keyed by the judge model that produced the original grade.
- [ ] #2 An agreement figure per rubric is computed from the accumulated labels and shown in run reports.
- [ ] #3 A judge-model change starts a new baseline; figures from different judge models are never merged.
<!-- AC:END -->
