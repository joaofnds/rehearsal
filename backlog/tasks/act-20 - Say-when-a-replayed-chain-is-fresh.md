---
id: ACT-20
title: Say when a replayed chain is fresh
status: Done
assignee:
  - '@claude'
created_date: '2026-08-31 04:12'
updated_date: '2026-08-31 12:53'
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
- [x] #1 Replaying a stage whose consumed checkpoint chain matches the current corpus, model, and effort prints `Checkpoint chain is fresh` exactly once.
- [x] #2 When an upstream corpus change makes checkpoints stale, replay prints one `Stale checkpoint <stage>: <causes>` line per stale checkpoint and does not print the fresh-chain line.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build handoff (2026-08-31)

Changed:
- Commit `113aca1` makes `runReplay` log `Checkpoint chain is fresh` exactly once when its consumed chain has no stale checkpoint. Existing per-stale-checkpoint lines and replay record fields are unchanged.
- Focused tests separate persisted fresh/stale state from CLI output and pin both output branches.

New capability and wiring:
- Every existing `runReplay` caller receives the fresh status through the existing `ReplayDependencies.log` boundary. Nothing remains unwired, and no caller remains on an old path.

Observed:
- Red: `prints when the checkpoint chain is fresh` failed with received `[]` against expected `["Checkpoint chain is fresh"]`. After the branch was added, it passed.
- Stale regression: the existing stale output first passed as characterization; making the fresh log unconditional caused the focused test to fail with both fresh and stale lines, proving it guards the branch. Restoring the condition made both checkpoint-chain tests pass.
- Direct focused executions exposed the captured logs: fresh emitted `["Checkpoint chain is fresh", "\nBuild session", "\nbuild stage Judge"]`; stale emitted `["Stale checkpoint discuss: skills/discuss/SKILL.md changed", "\nBuild session", "\nbuild stage Judge"]`.
- Final verification: `bun test` passed 244 tests with 0 failures; `bun run typecheck`, `bun run lint`, and `bun run fmt:check` passed.

Not verified:
- The real `replay-stage.ts` CLI was not run because this checkout has no recorded `.benchmark-runs` input; creating and replaying one would invoke paid model sessions outside this fix. `runReplay`, the behavior-owning boundary, was executed directly with deterministic dependencies.

Stopped work:
- The first format check found `run-benchmark.test.ts`; formatting the two task files resolved it. No product defect was found.

Refactor pass:
- Nothing to refactor. The branch belongs at the existing replay-output boundary; extraction would add indirection without removing duplicated policy.

Review:
- Independent review is due because the diff changes user-facing CLI output. Applicable axes: style, architecture, security, spec conformance, testing, and refactoring.

Independent review (2026-08-31)

Review input correction:
- The first user-invoked reviewer received `it`, which was not a ref, and reviewed only the unrelated uncommitted ACT-5 card change. Its clean result did not apply to ACT-20.
- The ACT-20 review used a materialized patch of commit `113aca1`, the task acceptance observations, and all applicable axis briefs. Both changed files, the replay CLI caller, staleness derivation, test harness, repository instructions, glossary, and style/testing references were examined.

Suite before review: `bun test` passed 244 tests with 0 failures.

Findings: one should-fix; no blocking findings or notes.

1. Testing, should-fix, fixed in `1f05dcd`: the stale-output fixture contained only one stale checkpoint, so an implementation that logged only the first staleness result would still pass while violating acceptance criterion 2. The fixture now records a second stage checkpoint; one upstream corpus change makes both discuss and build stale, and the test requires both output lines with no fresh line. Verification: changing the production loop to `staleness.slice(0, 1)` made the focused test fail because the build line disappeared; restoring the loop passed.

Axis disposition:
- Style: no findings.
- Architecture: no findings.
- Spec conformance: no findings.
- Security: no findings.
- Testing: one finding, fixed above.
- Refactoring: no findings.

Final verification after the review fix: `bun test` passed 244 tests with 0 failures; `bun run typecheck`, `bun run lint`, and `bun run fmt:check` passed.

Verdict: proceed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built in `113aca1`: replay prints `Checkpoint chain is fresh` for a fully fresh consumed chain and retains one cause-bearing line per stale checkpoint. Independent review found one should-fix testing gap, fixed in `1f05dcd` and mutation-verified. Direct log capture observed both output branches; 244 tests, typecheck, lint, and format check passed. No blocking findings remain.
<!-- SECTION:FINAL_SUMMARY:END -->
