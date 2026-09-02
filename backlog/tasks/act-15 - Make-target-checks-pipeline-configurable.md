---
id: ACT-15
title: Make target checks pipeline-configurable
status: Build
assignee:
  - '@claude'
created_date: '2026-08-30 23:00'
updated_date: '2026-09-02 00:05'
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
- [ ] #1 Loading a newly authored pipeline accepts a required target block containing a non-empty ordered checks list, where every check has a non-empty argument-vector command and optional string environment values, plus a non-empty unique list of target-relative integrity files; absent, empty, unknown, duplicate, absolute, or traversing definitions are rejected before target mutation or provider calls.
- [ ] #2 A normal run and pipeline confirmation using a custom target block execute only its declared checks, in declaration order and with each check environment overlaid on the host environment, at the existing baseline point before task setup or provider calls; a failed baseline check stops the run there.
- [ ] #3 Normal delivery, delivery replay, pipeline confirmation, and replay confirmation execute the recorded pipeline target checks after delivery validation; all successful commands produce authoritative local-checks PASS, while a failed command produces authoritative FAIL evidence naming that command.
- [ ] #4 Check integrity passes when every declared baseline file still exists with identical bytes, fails with each declared path that was changed or deleted, and ignores undeclared files; a declared file missing at baseline is rejected before workflow mutation or provider calls.
- [ ] #5 The default pipeline executes the current bun run typecheck, bun run check, and bun run test:unit commands with CONFIG_PATH=src/config/test.yaml and protects package.json, tsconfig.json, and biome.json.
- [ ] #6 Run manifests and frozen pipeline-confirmation inputs contain the resolved target configuration; replay uses the configuration recorded by its run, and comparison refuses arms whose frozen target configurations differ.
- [ ] #7 A stored run manifest that predates the target block loads with the former three commands, environment, and integrity files, while a newly authored pipeline without the target block is rejected.
- [ ] #8 README Final Grading and rubric.md describe pipeline-declared target checks and check-integrity files, retaining the local-checks and check-integrity rubric IDs and presenting the default target configuration only as an example.
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
<!-- SECTION:NOTES:END -->
