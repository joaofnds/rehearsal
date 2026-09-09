---
id: ACT-109
title: >-
  a comparison report keeps no per-rep grade, so the design's per-pair table has
  no rows
status: Shape
assignee: []
created_date: '2026-09-07 23:08'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-7
dependencies: []
references:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: bug
ordinal: 105008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Persist each repetition's outcome beside its identity so comparison rows can render from the report alone, with versioned legacy loading.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A persisted comparison report carries each rep's own grade, so a table with one row per paired attempt and one grade per arm can be rendered from the report alone, without re-reading rep records off disk (SPEC.md 5a makes each row a pair with a grade per arm; verified 2026-09-07 that reliabilitySummarySchema in src/benchmark/comparison-record.ts persists only gradeDistribution as a count map, and sourceRepSchema carries path, sha256, repId and ordinal with no grade)
- [ ] #2 The schema change carries its version forward the way comparison-record.ts already carries schemaVersion 2 with its v1 legacy branch, so an existing recorded comparison still loads
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Session benchmark scope accepted 2026-09-09 (doc-59): ACT-146 owns session comparison and partial-score semantics and should coordinate per-repetition presentation with this card. Its report must retain actual named check results instead of relying on an A/F aggregate. A display row paired by repetition ordinal does not establish statistical pairing; the estimator needs the sampling unit ACT-146 defines.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. Per-rep outcomes directly enable the accepted comparison table and cannot be recovered from the persisted aggregate distribution.

Evidence: sourceRepSchema has path/sha256/repId/ordinal only and reliabilitySummarySchema has aggregate gradeDistribution only; focused loader tests pass.

Unresolved claims/resources: No prerequisite for shaping; coordinate session presentation with ACT-146 without making it a prerequisite for existing reports.

Next action: Shape the per-rep outcome field briefly, bump the comparison schema with legacy loading, and retain named session checks where applicable.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
