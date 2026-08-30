---
id: ACT-2
title: record a checkpoint at every accepted stage transition
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies: []
references:
  - docs/design.md
ordinal: 2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a stage passes its Judge, freeze the state the next stage consumes: the target's commit SHA, the workflow state (backlog/, .boris/), the stage artifacts, and a lineage key hashing the upstream checkpoint, the corpus files feeding the stage, the model, and the effort. Checkpoints are the replay primitive and live in the run artifact. See docs/design.md 'Checkpoint and replay' and 'Concepts'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every accepted stage transition writes a checkpoint record: target SHA, workflow-state snapshot, stage artifacts, lineage key.
- [ ] #2 The lineage key changes when and only when an input changes: upstream checkpoint, any corpus file feeding the stage, model, or effort.
- [ ] #3 A test materializes a recorded checkpoint into an empty directory and the result matches the state the next stage consumed.
<!-- AC:END -->
