---
id: ACT-109
title: >-
  a comparison report keeps no per-rep grade, so the design's per-pair table has
  no rows
status: To Do
assignee: []
created_date: '2026-09-07 23:08'
updated_date: '2026-09-09 15:50'
labels: []
dependencies: []
references:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: bug
ordinal: 105008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A persisted comparison report carries each rep's own grade, so a table with one row per paired attempt and one grade per arm can be rendered from the report alone, without re-reading rep records off disk (SPEC.md 5a makes each row a pair with a grade per arm; verified 2026-09-07 that reliabilitySummarySchema in src/benchmark/comparison-record.ts persists only gradeDistribution as a count map, and sourceRepSchema carries path, sha256, repId and ordinal with no grade)
- [ ] #2 The schema change carries its version forward the way comparison-record.ts already carries schemaVersion 2 with its v1 legacy branch, so an existing recorded comparison still loads
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Session benchmark scope accepted 2026-09-09 (doc-59): ACT-146 owns session comparison and partial-score semantics and should coordinate per-repetition presentation with this card. Its report must retain actual named check results instead of relying on an A/F aggregate. A display row paired by repetition ordinal does not establish statistical pairing; the estimator needs the sampling unit ACT-146 defines.
<!-- SECTION:NOTES:END -->
