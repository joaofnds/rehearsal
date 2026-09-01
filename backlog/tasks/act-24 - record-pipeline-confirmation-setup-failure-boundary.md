---
id: ACT-24
title: record pipeline confirmation setup failure boundary
status: To Do
assignee: []
created_date: '2026-09-01 13:52'
labels: []
dependencies: []
references:
  - src/benchmark/pipeline-confirmation.ts
type: enhancement
ordinal: 18008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pipeline confirmation has an independent pre-session setup sequence and persists raw errors, so the same intermittent worktree/setup failure that motivated ACT-13.1 would remain unattributed in pipeline mode. Add stable operation context without relabeling stage or Judge failures; consider sharing an attribution abstraction with replay only if it reduces rather than couples their different orchestration state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An injected failure at each pipeline setup boundary persists the failing operation and original cause while preserving the existing diagnostic worktree behavior.
- [ ] #2 Stage, stage-Judge, and final-Judge failures retain their existing error attribution and evidence lifecycle.
<!-- AC:END -->
