---
id: ACT-5
title: run N reps in parallel worktrees
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies:
  - ACT-3
references:
  - docs/design.md
  - docs/research.md
ordinal: 5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run N replays of a stage, or N full-pipeline runs, in parallel host worktrees, one per rep. Report per-stage score distributions with standard errors, pass^k, cost, tokens, trajectory steps, and wall-clock. Confirmation runs default to 5 reps; a single rep is never presented as a score. See docs/design.md 'Execution model' and decision 6; evidence in docs/research.md 'Variance and statistics'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 N reps of a stage replay or a full pipeline run execute in parallel worktrees without interfering; each rep's evidence is recorded separately.
- [ ] #2 The report shows the score distribution with a standard error, pass^k, cost, tokens, trajectory steps, and wall-clock per stage.
- [ ] #3 Confirmation runs default to 5 reps; a 1-rep result is labeled as not a score.
- [ ] #4 Projected cost is shown before a multi-rep run starts.
<!-- AC:END -->
