---
id: ACT-20
title: Say when a replayed chain is fresh
status: To Do
assignee: []
created_date: '2026-08-31 04:12'
labels: []
dependencies: []
ordinal: 12008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/benchmark/replay.ts runReplay filters staleness to the stale checkpoints before logging, so a fully fresh chain prints nothing at all about staleness. The ACT-4 design intent was that staleness surfaces in the replay CLI output for the run's whole chain.

Consequence: a user cannot tell 'the chain is fresh' from 'this build predates the staleness feature'. The information is on disk either way, since the record carries stale: false and staleness: [].

Fix: log a single line naming the chain fresh when no checkpoint is stale.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Replaying against an unchanged corpus prints a line stating the chain is fresh
- [ ] #2 Replaying against a changed corpus still prints one line per stale checkpoint with its causes
<!-- AC:END -->
