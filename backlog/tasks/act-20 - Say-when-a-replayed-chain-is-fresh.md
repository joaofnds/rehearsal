---
id: ACT-20
title: Say when a replayed chain is fresh
status: Build
assignee:
  - '@claude'
created_date: '2026-08-31 04:12'
updated_date: '2026-08-31 12:28'
labels: []
dependencies: []
references:
  - ACT-4
  - src/benchmark/replay.ts
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
- [ ] #1 Replaying a stage whose consumed checkpoint chain matches the current corpus, model, and effort prints `Checkpoint chain is fresh` exactly once.
- [ ] #2 When an upstream corpus change makes checkpoints stale, replay prints one `Stale checkpoint <stage>: <causes>` line per stale checkpoint and does not print the fresh-chain line.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: make replay output explicitly say when the whole consumed checkpoint chain is fresh, without changing stale replay records or output.

What exists (read 2026-08-31):
- `runReplay` derives staleness for `plan.chain`, immediately filters the result to stale checkpoints, logs one line for each, and persists only those stale entries. A chain with no stale checkpoint therefore emits no staleness status even though its replay record correctly stores `stale: false` and `staleness: []`.
- `runReplay` tests already observe a fresh record and a stale log cause. The fresh test does not observe CLI output, and the stale test does not rule out a misleading fresh line.
- ACT-4 settled the output surface: staleness belongs in replay CLI output for the run's whole consumed chain. No listing command or new persistence field belongs in this task.

Resolved unknowns:
1. The fresh status is one exact line: `Checkpoint chain is fresh`. It is emitted at the existing staleness-reporting point before the replayed stage runs.
2. A chain is fresh only when `deriveStaleness` reports no stale checkpoint. If any checkpoint is stale, replay keeps the existing `Stale checkpoint <stage>: <causes>` line for each stale checkpoint and emits no fresh status.
3. Replay record and schema behavior stay unchanged: fresh remains `stale: false` with `staleness: []`; stale records retain their current entries.

Acceptance as observations:
1. A `runReplay` test with matching corpus, model, and effort observes `Checkpoint chain is fresh` exactly once.
2. A `runReplay` test with an upstream corpus mismatch observes one existing stale line per stale checkpoint, including its causes, and no fresh line.
3. `bun test`, `bun run typecheck`, `bun run lint`, and `bun run fmt:check` pass.

First test to write: extend the existing “labels the replay fresh when the corpus still matches the chain” test to expect `Checkpoint chain is fresh` exactly once; observe it fail before changing `runReplay`.

Glossary: added “Fresh checkpoint chain” as a replay's consumed chain containing no stale checkpoint.
<!-- SECTION:PLAN:END -->
