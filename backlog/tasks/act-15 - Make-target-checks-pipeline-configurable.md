---
id: ACT-15
title: Make target checks pipeline-configurable
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 23:00'
updated_date: '2026-09-02 01:07'
labels: []
dependencies: []
references:
  - src/benchmark/pipeline.ts
  - src/benchmark/checks.ts
  - src/benchmark/run.ts
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/replay.ts
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/manifest.ts
  - src/benchmark/checks.test.ts
  - pipelines/default.json
  - README.md
  - rubric.md
  - GLOSSARY.md
ordinal: 7008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Let each pipeline declare the target repository checks and check-integrity files that govern baseline and delivery grading, with no newly authored pipeline inheriting target-specific harness defaults.

Today the harness runs three fixed Bun commands with one fixed CONFIG_PATH and hashes three fixed files. That prevents a pipeline from describing an arbitrary target repository and leaves the measured local-checks and check-integrity contract outside the frozen pipeline input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Loading a newly authored pipeline accepts a required target block containing a non-empty ordered checks list, where every check has a non-empty argument-vector command and optional string environment values, plus a non-empty unique list of target-relative integrity files; absent, empty, unknown, duplicate, absolute, or traversing definitions are rejected before target mutation or provider calls.
- [x] #2 A normal run and pipeline confirmation using a custom target block execute only its declared checks, in declaration order and with each check environment overlaid on the host environment, at the existing baseline point before task setup or provider calls; a failed baseline check stops the run there.
- [x] #3 Normal delivery, delivery replay, pipeline confirmation, and replay confirmation execute the recorded pipeline target checks after delivery validation; all successful commands produce authoritative local-checks PASS, while a failed command produces authoritative FAIL evidence naming that command.
- [x] #4 Check integrity passes when every declared baseline file still exists with identical bytes, fails with each declared path that was changed or deleted, and ignores undeclared files; a declared file missing at baseline is rejected before workflow mutation or provider calls.
- [x] #5 The default pipeline executes the current bun run typecheck, bun run check, and bun run test:unit commands with CONFIG_PATH=src/config/test.yaml and protects package.json, tsconfig.json, and biome.json.
- [x] #6 Run manifests and frozen pipeline-confirmation inputs contain the resolved target configuration; replay uses the configuration recorded by its run, and comparison refuses arms whose frozen target configurations differ.
- [x] #7 A stored run manifest that predates the target block loads with the former three commands, environment, and integrity files, while a newly authored pipeline without the target block is rejected.
- [x] #8 README Final Grading and rubric.md describe pipeline-declared target checks and check-integrity files, retaining the local-checks and check-integrity rubric IDs and presenting the default target configuration only as an example.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define and validate the required pipeline target block, keep the top-level authored schema fail-fast, and adapt legacy manifests to an explicit former target configuration only at the stored-data boundary.
2. Pass the parsed target configuration through normal runs, pipeline confirmation, replay, and replay confirmation. Make check execution and integrity capture consume that value rather than control-repository constants.
3. Drive the change from check-level behavior tests, then add pipeline parsing, orchestration, persisted-manifest, replay, confirmation, and comparison regressions.
4. Move the former defaults into pipelines/default.json and update README, rubric.md, and the glossary. Run focused tests, then formatting, lint, type checking, and the full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping decisions and resolved unknowns:
- Placement: target-specific data belongs in a required target block inside the pipeline definition. The parsed pipeline is already persisted, frozen for confirmations, and controlled during comparison, so this keeps the grading contract with the workflow input.
- Baseline versus treatment: one ordered target-check list runs at both points. The existing harness uses one set, and using different sets would break the baseline/treatment comparison that detects regressions.
- Command model: each check is an argument vector with an optional per-command environment map. This matches runCommand, avoids shell parsing, and removes the fixed CONFIG_PATH without assuming every command shares one environment.
- Integrity model: check-integrity files are unique target-relative files. Their baseline presence and bytes are the contract; missing baseline files and paths outside the target are configuration errors rather than hashes of an ambiguous absence.
- Compatibility: replayable manifests already exist without target configuration. Manifest loading maps only those stored records to the former target configuration; newly authored pipelines receive no fallback.
- Language: Target check and Check-integrity file are added to GLOSSARY.md. Existing rubric IDs local-checks and check-integrity remain stable.
- Open questions: none.

First test to write: in src/benchmark/checks.test.ts, configure two harmless Bun commands that append their distinct environment values to one marker file, call runChecks with that configuration, and assert the marker records declaration order. Predict RED because runChecks currently accepts no target configuration and invokes the three fixed package scripts.

## Build handoff

Changed: Pipeline definitions now require a strict target block with ordered argument-vector checks, per-check environment overlays, and unique safe target-relative integrity files. Normal runs, pipeline confirmations, delivery replays, and replay confirmations use the recorded target configuration for baseline and delivery evidence. Manifests persist the resolved target; pre-target manifests resolve the former NestJS configuration only at load time. Frozen pipelines control comparison compatibility. The default pipeline, README, and rubric carry the declared contract.

Available but unwired: none. Every production baseline, delivery, replay, and confirmation caller uses the recorded target; no caller remains on the former fixed check path.

Observed: bun test passed 396 tests with 808 expectations. bun run typecheck, bun run lint, bun run fmt:check, and git diff --check da59b30..HEAD passed. A direct production-API run printed ORDER=first:configured:host, INTEGRITY=PASS->FAIL, ALIASED_DUPLICATE=rejected, and LAUNCH_FAILURE_PATH=act-15-command-does-not-exist. No paid provider call or full live benchmark was run.

Defects encountered: the first focused batch exposed a test fixture declaring package.json in a repository that only contained base.txt; the strict missing-baseline guard rejected it, and the fixture now declares its real file. No separate backlog task was needed.

Refactor pass: localized the former target defaults to the legacy manifest adapter; general harness configuration no longer owns target-specific defaults.

Independent review: required and completed because pipeline input is an untrusted command-execution boundary. Two blocking findings were fixed: normalized path aliases now count as duplicate integrity files, and launch failures retain the declared command in FAIL evidence. Two should-fix test findings were fixed: environment precedence now proves configured values override a host key while retaining unrelated host values; normal-run baseline, delivery replay confirmation, and the complete default target are pinned. One should-fix scope finding was not a defect: ACT-8 changes came from concurrent commits 1abaed6 and 582e3ea and were not modified. Style, architecture, spec, security, testing, and refactoring axes were all reviewed; no axis was skipped. No review finding remains open.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made target grading pipeline-configurable across normal runs, confirmations, and replays. Strict target parsing rejects unsafe or ambiguous declarations; authoritative delivery evidence names failed commands and compares exactly the declared files; manifests preserve new and legacy runs; comparison freezes the target contract; the default pipeline and documentation now describe the NestJS configuration as an example. Independent review findings were resolved. Final verification passed 396 tests, typecheck, lint, format, and diff checks; direct execution observed ordered environment overlays, PASS-to-FAIL integrity on deletion, duplicate-alias rejection, and launch-failure command evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
