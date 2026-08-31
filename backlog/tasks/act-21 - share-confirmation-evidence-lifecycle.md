---
id: ACT-21
title: share confirmation evidence lifecycle
status: To Do
assignee: []
created_date: '2026-08-31 22:10'
labels: []
dependencies: []
references:
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/pipeline-confirmation.ts
type: task
ordinal: 14008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-5 exposed duplicated frozen-file enumeration, metric completeness, rep failure recording, report persistence, and cleanup policy in replay-confirmation.ts and pipeline-confirmation.ts. The copies have already diverged. Extract shared functions for those stable policies while keeping stage-specific and pipeline-specific orchestration direct.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Replay and pipeline confirmation use one shared implementation to enumerate and hash frozen files.
- [ ] #2 Replay and pipeline confirmation use one shared implementation to classify required call metrics without dropping metric-less attempts.
- [ ] #3 Replay and pipeline confirmation use one shared policy for durable failure evidence, retention refs, diagnostic worktree preservation, and completed-worktree cleanup.
- [ ] #4 Existing replay and pipeline confirmation integration tests remain green without changing their observable records or reports.
<!-- AC:END -->
