---
id: ACT-68
title: >-
  captureStageCorpus and snapshotStageCorpus take instructions as a bare string,
  unlike every other corpus kind
status: To Do
assignee: []
created_date: '2026-09-04 22:48'
updated_date: '2026-09-09 13:01'
labels: []
milestone: m-1
dependencies:
  - ACT-65
priority: medium
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

Decision by the overseeing iterate session, 2026-09-09, settling the question doc-54 left open: whether m-1's last two cards must finish before the UI work. They need not, and this card is NOT raised above the UI cards.

Read this run, doc-7 'The order': m-1 is 'Prove the loop once', its stated substance is that 'the tool has never answered its own question', and its named gate is ACT-41 -> ACT-39. Both are Done, as are the other 11 of 13. What remains under the milestone label is this card and ACT-93, neither of which is the loop: one is an interface inconsistency, the other a missing test on a branch that already works. So 'prove the loop once' is already met in the sense doc-7 wrote it, and holding the UI behind these two would be reading the milestone's counter rather than its goal.

Recorded here rather than in a doc because triage owns the triage docs. Whoever runs triage next should carry this into the next one, or overturn it with the reason.

Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set Medium this run, from unprioritized.

Medium because it is one of the two cards left in m-1, the goal's first increment, which stands at 13 of 15. doc-54 recorded raising this card and ACT-93 as an unsettled product question and did not act. This run acts on it, per the standing direction to take the recommendation and record it as unsettled rather than end the turn on a question.

Its criterion is satisfiable either way, by making instructions resolve like the other roots or by documenting the asymmetry as deliberate, so it cannot block on a design argument.

Recorded as unsettled, and it is the same question doc-54 raised: whether 'prove the loop once' means every m-1 card is Done or the loop demonstrably running. Medium reflects the first reading without outranking the containment defects, which the second reading would not change.
<!-- SECTION:NOTES:END -->
