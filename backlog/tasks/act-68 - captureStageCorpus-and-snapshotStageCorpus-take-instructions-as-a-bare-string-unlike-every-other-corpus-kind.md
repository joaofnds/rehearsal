---
id: ACT-68
title: >-
  captureStageCorpus and snapshotStageCorpus take instructions as a bare string,
  unlike every other corpus kind
status: To Do
assignee: []
created_date: '2026-09-04 22:48'
updated_date: '2026-09-04 23:01'
labels: []
milestone: m-1
dependencies:
  - ACT-65
type: bug
ordinal: 64008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Carried from the independent review of ACT-41 and left unresolved by ACT-65's fix.

captureStageCorpus and snapshotStageCorpus (src/benchmark/checkpoint.ts) take instructions as a bare string parameter, while every other corpus kind (skills, agents, output-styles) is resolved from the corpus roots. That asymmetry is what allowed ACT-65's defect to exist: snapshotStageCorpus wrote the instruction bytes into the snapshot while installStageCorpusSnapshot never installed them, so the bytes were hashed into the record and never read by any session. Nothing in the types connected the write to the read.

ACT-65 fixed the missing delivery by copying the snapshot's CLAUDE.md into the worktree's .claude directory. It did not remove the asymmetry, so the same class of defect can recur.

Resolve by resolving instructions from roots like the other kinds, or by documenting the asymmetry as deliberate with the reason.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 instructions are resolved from roots the same way skills, agents, and output styles are, or the asymmetry is documented as deliberate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Advisory note carried from the ACT-65 review: captureStageCorpus and snapshotStageCorpus (checkpoint.ts) take instructions as a bare string while every other corpus kind (skills, agents, output-styles) is resolved from roots. That asymmetry is what let a write (snapshotStageCorpus writing CLAUDE.md) exist with nothing reading it for months, undetected. ACT-65 fixed the missing read; this card is about whether the write-side design itself should change to prevent the same class of bug.
<!-- SECTION:NOTES:END -->
