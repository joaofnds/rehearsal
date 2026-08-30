---
id: ACT-4
title: invalidate checkpoints when the corpus changes
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies:
  - ACT-2
references:
  - docs/design.md
ordinal: 4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Map corpus files to the stages they feed: each stage skill to its stage, global instruction files (installed CLAUDE.md) to every stage. A corpus edit marks downstream checkpoints stale. Stale checkpoints remain replayable for exploration, but comparisons across mismatched lineages are refused. See docs/design.md 'Invalidation graph' and decision 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness derives, from the set of changed corpus files, exactly which stages and checkpoints are stale.
- [ ] #2 Editing a stage skill marks that stage's and all downstream checkpoints stale; editing a global instruction file marks all stale; a model or effort change marks all stale.
- [ ] #3 Replaying from a stale checkpoint works and is labeled stale in the record.
- [ ] #4 Comparing attempts whose lineages differ is refused with an error naming the mismatched inputs.
<!-- AC:END -->
