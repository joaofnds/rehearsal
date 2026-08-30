---
id: ACT-6
title: report paired comparisons between corpus versions
status: To Do
assignee: []
created_date: '2026-08-30 12:43'
labels: []
dependencies:
  - ACT-4
  - ACT-5
references:
  - docs/design.md
  - docs/research.md
ordinal: 6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Compare two corpus versions by running both from identical checkpoints and reporting paired per-task deltas with standard errors, stage by stage, always beside a no-corpus (or minimal-corpus) control arm, with cost and trajectory length beside quality so verbosity can never score as improvement. See docs/design.md decisions 6-7; evidence in docs/research.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison runs two corpus versions from identical checkpoints and reports paired per-task score deltas with standard errors, per stage.
- [ ] #2 Every comparison includes the control arm, and reports cost, tokens, and trajectory steps beside quality for each arm.
- [ ] #3 A comparison across mismatched lineages is refused.
<!-- AC:END -->
