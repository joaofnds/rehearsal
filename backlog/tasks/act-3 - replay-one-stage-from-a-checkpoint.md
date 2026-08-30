---
id: ACT-3
title: replay one stage from a checkpoint
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies:
  - ACT-2
references:
  - docs/design.md
ordinal: 3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The inner-loop primitive: a command that takes a checkpoint and the current corpus, materializes the checkpoint in a fresh host git worktree of the target, runs that one stage, and records a stage artifact comparable with prior attempts at the same checkpoint. The primary checkout is never touched. See docs/design.md 'Checkpoint and replay' and 'Execution model'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A CLI command replays a chosen stage from a chosen checkpoint in a fresh worktree; the primary checkout and its branch are untouched throughout.
- [ ] #2 The replay records artifacts, trajectory, cost, and Judge result like a normal stage run, marked as a replay with its checkpoint and corpus version.
- [ ] #3 Attempts at the same checkpoint can be presented side by side: artifacts, Judge grades, and diffs.
- [ ] #4 The worktree is removed after grading; on failure the evidence is preserved and its path printed.
<!-- AC:END -->
