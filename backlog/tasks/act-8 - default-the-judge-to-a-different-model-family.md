---
id: ACT-8
title: default the judge to a different model family
status: Shape
assignee: []
created_date: '2026-08-30 12:43'
updated_date: '2026-09-02 00:08'
labels: []
dependencies: []
references:
  - docs/design.md
  - docs/research.md
ordinal: 8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Self-preference bias: judges favor outputs from their own model family. Default the Judge model to a different family (or at minimum a different model) than the workflow model, keeping the explicit --judge-model override. See docs/design.md decision 8; evidence in docs/research.md 'Judge reliability'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When no judge model is specified, the harness picks one that differs from the workflow model and records the choice in the run artifact.
- [ ] #2 An explicit --judge-model or BENCHMARK_JUDGE_MODEL still wins; choosing the workflow model prints a self-preference warning.
<!-- AC:END -->
