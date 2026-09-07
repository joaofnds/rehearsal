---
id: ACT-101
title: 'state staleness as a version distance, not only a boolean with causes'
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
ordinal: 97008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's run history row shows staleness with a distance: 'stale, corpus changes since' and 'superseded, 2 versions back'. staleness-report.ts's staleCheckpoints/staleCases and checkpoint.ts's deriveStaleness answer stale: boolean plus causes: readonly string[] (named files, model, or effort that changed) with no count of how many corpus versions separate the recorded run from the current one. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stale record's report states how many distinct corpus versions separate it from the current corpus, not only that it differs
<!-- AC:END -->
