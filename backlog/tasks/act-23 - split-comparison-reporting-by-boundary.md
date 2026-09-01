---
id: ACT-23
title: split comparison reporting by boundary
status: To Do
assignee: []
created_date: '2026-09-01 11:11'
labels: []
dependencies:
  - ACT-6
references:
  - src/benchmark/comparison-evidence.ts
  - src/benchmark/comparison-report.ts
  - src/benchmark/comparison-record.ts
type: chore
ordinal: 16008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-6 made comparison-evidence.ts responsible for filesystem loading, frozen-file verification, rep/group consistency, treatment projection, and cross-arm comparability, while comparison-report.ts owns estimation, quality, resources, missing-evidence policy, provenance assembly, and schema projection. Split these along their axes of change without altering the comparison manifest, report bytes, or CLI behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A completed-comparison fixture produces byte-identical report.json content and the same printed path before and after the split.
- [ ] #2 Manifest/report schemas, filesystem evidence loading, comparability policy, paired estimation, and quality/resource projection each have one named module owner with no duplicated contrast or rep-count rules.
- [ ] #3 Focused tests live with each owner and preserve all contextual validation errors and missing-metric unavailability behavior.
- [ ] #4 bun test, bun run typecheck, bun run lint, and bun run fmt:check all exit successfully.
<!-- AC:END -->
