---
id: ACT-8
title: default the judge to a different model family
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-09-02 02:04'
labels: []
dependencies: []
references:
  - docs/design.md
  - docs/research.md
  - GLOSSARY.md
ordinal: 8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Choose a Judge model from a different recognized Claude model family than the workflow by default, while preserving explicit overrides and making self-preference visible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With no Judge override, both benchmark and replay resolve `sonnet`, `haiku`, and unrecognized workflow identifiers to Judge model `opus`.
- [x] #2 With no Judge override, both benchmark and replay resolve the `opus` alias and full Claude model IDs in the Opus family to Judge model `sonnet`.
- [x] #3 For benchmark and replay, `--judge-model` overrides `BENCHMARK_JUDGE_MODEL`, and `BENCHMARK_JUDGE_MODEL` overrides the family-aware default.
- [x] #4 Either command given an explicit Judge identifier equal to the workflow identifier or in the same recognized model family writes one self-preference warning to stderr before target or checkpoint access and continues with that explicit choice.
- [x] #5 Either command given an explicit Judge from a different recognized family, or using its automatic default, writes no self-preference warning.
- [x] #6 Benchmark manifests and run artifacts, replay records, and pipeline or stage confirmation records contain the resolved `judgeModel` selected by the command.
- [x] #7 The README describes the Opus/Sonnet default policy, explicit override precedence, and the self-preference warning.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Resolve the Judge model once at the configuration boundary shared by benchmark and replay. Recognize Opus, Sonnet, and Haiku from native aliases and full Claude model IDs; default to `opus`, except that an Opus workflow defaults to `sonnet`. Keep model identifiers opaque after this boundary.

Keep the existing CLI > environment > default precedence. Have both entry points report the configuration warning before they inspect the target or recorded run. No provider abstraction or user-authored family map is introduced.

Keep the artifact schemas unchanged: every execution mode already persists the resolved `judgeModel`; tests prove the new default reaches those existing records.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Resolved unknowns

- João chose the tier-aware Claude policy rather than exact-string matching or a configured model map. In the project language, the recognized tiers are model families.
- The default Judge is `opus`; an Opus-family workflow uses `sonnet`; an unrecognized workflow identifier uses `opus`.
- Native aliases and full model IDs that identify Opus, Sonnet, or Haiku belong to the same model family for defaulting and warnings. Exact equal identifiers also warn even when their family is unrecognized.
- An explicit same-family Judge remains allowed because the existing override is intentional; the harness warns rather than rejects it.
- The policy applies to benchmark and replay, in both single-rep and confirmation paths. Existing records already carry `judgeModel`, so this task does not change their schemas.

## Glossary

Added `Model family` to `GLOSSARY.md`.

## First test

In `src/benchmark/config.test.ts`, first replace the current same-model default expectation with a table showing that no override resolves a Sonnet workflow to `opus` and an Opus full model ID to `sonnet`, for both `parseArgs` and `parseReplayArgs`. Observe it fail against the current fallback-to-workflow behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## What changed

- Benchmark and replay now default Judge to `opus`, except recognized Opus aliases and full Claude IDs default to `sonnet`; opaque identifiers remain unclassified.
- CLI and environment Judge overrides retain CLI > environment > default precedence. Explicit equal or same-family selections continue after one stderr self-preference warning at each command boundary.
- Run manifests and artifacts, replay records, and pipeline and stage confirmation records retain the resolved `judgeModel`; parser-to-record tests guard every path.
- README documents the defaults, precedence, and warning.

## Unwired or old paths

None. Both command entry points and all debug and confirmation record paths consume the resolved configuration. No schema migration was needed.

## Observed

- `bun test`: 419 passed, 0 failed, 836 expectations across 31 files.
- `bun run typecheck`, `bun run lint`, and `bun run fmt:check`: passed.
- Direct parser invocation observed Sonnet -> Opus, `claude-opus-4-8` -> Sonnet, and opaque `vendor-opus-model` -> Opus.
- Direct production CLI invocation observed one warning before benchmark confirmation refusal and one warning before replay reported a missing run.
- Five `judgeModel -> model` mutation probes each failed its parser-to-record test for manifest, final artifact, replay, pipeline confirmation, and stage confirmation persistence.

## Not verified

No paid Claude benchmark or replay session was started. Provider invocation is unchanged; local harnesses observed every persistence path.

## Independent review

Required for the user-facing CLI change and completed in one round. All changed files and all six axes were examined; style, architecture, security, and refactoring found nothing.

- Blocking correctness/spec: arbitrary identifiers containing `opus`, `sonnet`, or `haiku` were misclassified as Claude IDs. Fixed in `fbf7208`; aliases or identifiers with a `claude` segment now establish family, and regression tests cover the opaque case.
- Should-fix testing: resolved Judge persistence was not guarded end to end. Fixed in `0f74826`; parser-to-record tests cover all five assignments and were verified with mutations.

Review verdict after disposition: proceed; no open findings.
<!-- SECTION:FINAL_SUMMARY:END -->
