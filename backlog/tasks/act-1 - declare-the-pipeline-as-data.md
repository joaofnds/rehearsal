---
id: ACT-1
title: declare the pipeline as data
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies: []
references:
  - docs/design.md
ordinal: 1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Discuss → Grill → Plan → Build sequence, each stage's skill, artifact expectations, and judge attachment are code in src/benchmark. Extract them into a declared pipeline definition the harness reads, so stages can be added, removed, or reordered without editing the stage loop. The stage loop already runs behind an injectable seam; make the injected value come from the definition. See docs/design.md 'Pipeline as data'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pipeline definition (data, not code) names each stage with its skill, expected artifacts, and judge attachment.
- [ ] #2 The harness runs the current four-stage pipeline from that definition with behavior unchanged: a full run produces the same artifacts, validations, and run-artifact records as before.
- [ ] #3 Removing or reordering a stage in the definition changes the run accordingly with no TypeScript change.
- [ ] #4 A malformed definition is rejected at startup with an error naming the defect.
<!-- AC:END -->
