---
id: ACT-68
title: >-
  captureStageCorpus and snapshotStageCorpus take instructions as a bare string,
  unlike every other corpus kind
status: To Do
assignee: []
created_date: '2026-09-04 22:48'
updated_date: '2026-09-04 22:48'
labels: []
dependencies:
  - ACT-65
type: bug
ordinal: 64008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 instructions are resolved from roots the same way skills, agents, and output styles are, or the asymmetry is documented as deliberate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Advisory note carried from the ACT-65 review: captureStageCorpus and snapshotStageCorpus (checkpoint.ts) take instructions as a bare string while every other corpus kind (skills, agents, output-styles) is resolved from roots. That asymmetry is what let a write (snapshotStageCorpus writing CLAUDE.md) exist with nothing reading it for months, undetected. ACT-65 fixed the missing read; this card is about whether the write-side design itself should change to prevent the same class of bug.
<!-- SECTION:NOTES:END -->
