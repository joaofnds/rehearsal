---
id: ACT-12
title: deduplicate the CLI session knobs between run and replay parsing
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 21:27'
updated_date: '2026-09-02 16:21'
labels: []
dependencies: []
modified_files:
  - src/benchmark/config.test.ts
  - src/benchmark/config.ts
type: task
ordinal: 4008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Have run and replay resolve every shared session knob through one implementation so future changes cannot make their behavior diverge.

ACT-3 added parseReplayArgs beside parseArgs in src/benchmark/config.ts. The duplicated scope is model, effort, Judge model, Judge effort, session budget, their BENCHMARK_* environment fallbacks, and their validation. Confirmation parsing is already shared and remains outside this refactor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Given equivalent explicit CLI session knobs and conflicting environment values, parseArgs and parseReplayArgs return identical session values and the CLI values win.
- [x] #2 Given equivalent BENCHMARK_MODEL, BENCHMARK_EFFORT, BENCHMARK_JUDGE_MODEL, BENCHMARK_JUDGE_EFFORT, and BENCHMARK_SESSION_BUDGET_USD values, parseArgs and parseReplayArgs return identical session values.
- [x] #3 Both parsers reject a missing workflow model with the existing Provide --model or BENCHMARK_MODEL error.
- [x] #4 Both parsers reject a missing session budget with the existing Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD error.
- [x] #5 Both parsers reject a non-numeric session budget with the existing Session budget must be a positive number error.
- [x] #6 Both parsers reject a zero or negative session budget with the existing Session budget must be a positive number error.
- [x] #7 Both parsers reject an unsupported workflow effort with the existing workflow-specific error.
- [x] #8 Both parsers reject an unsupported Judge effort with the existing Judge-specific error.
- [x] #9 Inspection of src/benchmark/config.ts finds one private session-knob parser containing the shared CLI/environment precedence and validation, called by both parseArgs and parseReplayArgs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a table-driven characterization that projects the five session fields from both public parsers and compares them for explicit CLI-over-environment and environment-only inputs.
2. Extract the common session-knob resolution and validation into one private parser; leave target, pipeline, run, stage, and confirmation concerns at their existing boundaries.
3. Run the focused config tests, then the full test, typecheck, lint, and format checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Resolved unknowns:
- The coordination blocker is gone: commits 0e2a3a6, c564f37, and 19f92b6 landed the tsconfig/oxlint hardening in config.ts, and config.ts had no uncommitted edits when shaping began.
- This is behavior-preserving: public config types, flags, environment names, precedence, defaults, and error text remain unchanged.
- Shared scope means model, effort, Judge model, Judge effort, and session budget. Confirmation is already handled by parseConfirmation and is not part of this extraction.

Glossary:
- Added Session knobs to GLOSSARY.md.

First test:
- Add the table-driven run/replay session parity characterization, temporarily perturb one parser to observe it fail, restore it, then perform the refactor. The existing focused baseline was 33 passing tests.

Build handoff (2026-09-02):
- Changed: added run/replay parity and exact shared-validation characterizations; extracted `parseSessionKnobs` as the single owner of workflow model, effort, Judge model, Judge effort, and session budget CLI/environment precedence, defaults, and validation; both public config types now extend the same private session shape.
- Newly possible but not wired: none. `parseArgs` and `parseReplayArgs` both use the shared parser; no caller remains on duplicated session parsing.
- Observed: `bun test src/benchmark/config.test.ts` passed 42 tests. Final `bun test` passed 453 tests across 35 files; `bun run typecheck`, `bun run lint`, and `bun run fmt:check` exited successfully. A direct Bun invocation with conflicting environment values printed identical run and replay session values selected from CLI: sonnet/high, haiku/xhigh, and USD 5.
- Not verified: nothing within the acceptance criteria remains unverified.
- Stopped work: format and type-aware lint rejected the first characterization-test shape; both defects were fixed in `19a6ab7` and `2c48e51`, then every gate was rerun successfully.
- Refactor pass: deduplicated the session field contract across both public config interfaces in `8756c72`; no larger structural task was warranted.
- Independent review: due because this changes the CLI parsing path other users run.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-02 16:21
---
Review (2026-09-02): clean. Reviewed the implementation range cd41ae5..8756c72 in src/benchmark/config.ts and src/benchmark/config.test.ts, plus direct production callers run-benchmark.ts and replay-stage.ts. Style, architecture, security, spec conformance, testing, and refactoring axes found nothing; no axes were skipped. The shared parser preserves each of the nine acceptance observations, including precedence, environment fallback, defaults, and validation. Observed: bun test passed 453 tests across 35 files; bun run typecheck, bun run lint, and bun run fmt:check exited successfully. A direct Bun invocation with conflicting environment values printed identical CLI-selected session values for run and replay. Verdict: proceed.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Run and replay now resolve all five shared session knobs through one private parser, with public parity tests covering CLI precedence, environment fallback, and every existing validation error. Observed 453 tests and every type, lint, and format gate pass; direct invocation printed identical CLI-selected session values for both parsers.
<!-- SECTION:FINAL_SUMMARY:END -->
