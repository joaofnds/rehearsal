---
id: ACT-92
title: >-
  test that executeReplay actually wires replayCorpusRoots into the confirmation
  request
status: To Do
assignee: []
created_date: '2026-09-07 00:17'
updated_date: '2026-09-09 16:20'
labels: []
dependencies: []
priority: low
type: bug
ordinal: 88008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test the real executeReplay wiring of a run manifest's sourceRoot into replay corpus roots.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test drives runReplayCommand's real execute path (executeReplay), not a Fake standing in for it, and fails when the corpusRoots argument executeReplay passes to executeReplayStage is reverted to a value derived from CONTROL_DIR instead of the run's own manifest.sourceRoot (code review finding on ACT-63, testing axis, mutation-confirmed)
- [ ] #2 The fix does not require paying for a real Claude session: either executeReplay's ReplayDependencies become injectable at the point rehearsal.ts wires execute: executeReplay, or an equivalent seam is added, so the test stays fast
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: low. Production replay wiring is correct but only its helper is pinned by tests.

Evidence: executeReplay passes replayCorpusRoots(manifestFile); focused replay tests pass but do not drive the real execute seam with fakes.

Unresolved claims/resources: None for the next action.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Inject executeReplay dependencies and mutation-check corpusRoots wiring without a provider.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
