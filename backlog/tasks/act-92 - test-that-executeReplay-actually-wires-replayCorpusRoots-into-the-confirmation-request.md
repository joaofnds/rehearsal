---
id: ACT-92
title: >-
  test that executeReplay actually wires replayCorpusRoots into the confirmation
  request
status: To Do
assignee: []
created_date: '2026-09-07 00:17'
labels: []
dependencies: []
type: bug
ordinal: 88008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test drives runReplayCommand's real execute path (executeReplay), not a Fake standing in for it, and fails when the corpusRoots argument executeReplay passes to executeReplayStage is reverted to a value derived from CONTROL_DIR instead of the run's own manifest.sourceRoot (code review finding on ACT-63, testing axis, mutation-confirmed)
- [ ] #2 The fix does not require paying for a real Claude session: either executeReplay's ReplayDependencies become injectable at the point rehearsal.ts wires execute: executeReplay, or an equivalent seam is added, so the test stays fast
<!-- AC:END -->
