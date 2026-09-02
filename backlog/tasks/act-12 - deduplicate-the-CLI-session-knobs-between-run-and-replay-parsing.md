---
id: ACT-12
title: deduplicate the CLI session knobs between run and replay parsing
status: Build
assignee: []
created_date: '2026-08-30 21:27'
updated_date: '2026-09-02 14:53'
labels: []
dependencies: []
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
- [ ] #1 Given equivalent explicit CLI session knobs and conflicting environment values, parseArgs and parseReplayArgs return identical session values and the CLI values win.
- [ ] #2 Given equivalent BENCHMARK_MODEL, BENCHMARK_EFFORT, BENCHMARK_JUDGE_MODEL, BENCHMARK_JUDGE_EFFORT, and BENCHMARK_SESSION_BUDGET_USD values, parseArgs and parseReplayArgs return identical session values.
- [ ] #3 Both parsers reject a missing workflow model with the existing Provide --model or BENCHMARK_MODEL error.
- [ ] #4 Both parsers reject a missing session budget with the existing Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD error.
- [ ] #5 Both parsers reject a non-numeric session budget with the existing Session budget must be a positive number error.
- [ ] #6 Both parsers reject a zero or negative session budget with the existing Session budget must be a positive number error.
- [ ] #7 Both parsers reject an unsupported workflow effort with the existing workflow-specific error.
- [ ] #8 Both parsers reject an unsupported Judge effort with the existing Judge-specific error.
- [ ] #9 Inspection of src/benchmark/config.ts finds one private session-knob parser containing the shared CLI/environment precedence and validation, called by both parseArgs and parseReplayArgs.
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
<!-- SECTION:NOTES:END -->
