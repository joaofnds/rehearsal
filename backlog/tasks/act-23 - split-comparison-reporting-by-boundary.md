---
id: ACT-23
title: split comparison reporting by boundary
status: Review
assignee:
  - '@claude'
created_date: '2026-09-01 11:11'
updated_date: '2026-09-02 15:26'
labels: []
dependencies:
  - ACT-6
references:
  - src/benchmark/comparison-command.ts
  - src/benchmark/comparison-evidence.ts
  - src/benchmark/comparison-loader.test.ts
  - src/benchmark/comparison-record.ts
  - src/benchmark/comparison-record.test.ts
  - src/benchmark/comparison-report.ts
  - src/benchmark/comparison-report.test.ts
  - compare-confirmations.ts
modified_files:
  - src/benchmark/__snapshots__/comparison-loader.test.ts.snap
  - src/benchmark/comparison-command.ts
  - src/benchmark/comparison-comparability.test.ts
  - src/benchmark/comparison-comparability.ts
  - src/benchmark/comparison-evidence.ts
  - src/benchmark/comparison-estimator.test.ts
  - src/benchmark/comparison-estimator.ts
  - src/benchmark/comparison-loader.test.ts
  - src/benchmark/comparison-loader.ts
  - src/benchmark/comparison-quality.test.ts
  - src/benchmark/comparison-quality.ts
  - src/benchmark/comparison-record.ts
  - src/benchmark/comparison-report.test.ts
  - src/benchmark/comparison-report.ts
  - src/benchmark/comparison-resources.test.ts
  - src/benchmark/comparison-resources.ts
  - src/benchmark/comparison-test-fixtures.ts
type: chore
ordinal: 16008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split comparison reporting into modules aligned with schemas, evidence loading, comparability, estimation, quality, resources, and final assembly while preserving every external byte and behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A completed two-case, three-arm comparison fixture pins the current report.json text byte for byte, including field order, two-space indentation, and trailing newline; the CLI prints the exact report path independently derived from the manifest digest and run layout before the first move and after the split, with source evidence unchanged and no external command executed.
- [x] #2 comparison-record.ts remains the sole owner of strict schema-version-1 manifest and report parsing plus canonical report serialization; existing valid records parse identically, invalid manifest errors retain case, arm, and field context, and the serialized bytes match the characterization fixture.
- [x] #3 comparison-loader.ts alone performs manifest-relative filesystem reads, hashing, group and rep parsing, frozen-byte verification, and rep-to-group consistency checks; focused loader tests preserve every existing contextual missing, invalid, and digest-mismatch error.
- [x] #4 comparison-comparability.ts alone projects executed corpus versus controlled inputs and enforces within-case controlled-input equality, cross-case arm corpus identity, one mode/stage/rep contract, and the expected rep count; focused comparability tests preserve every named mismatch and pipeline-checkpoint normalization behavior.
- [x] #5 comparison-estimator.ts owns the canonical candidate-minus-baseline, candidate-minus-control, and baseline-minus-control definitions and case-clustered paired estimation; focused tests observe case deltas 0.5 and 1, mean delta 0.75, standard error 0.25, and unchanged output after rep order reversal, while quality, resources, and report assembly consume those definitions without repeating arm pairs.
- [x] #6 comparison-quality.ts preserves every per-case arm reliability summary and all quality contrasts, while comparison-resources.ts preserves per-role and total metrics, worker turns, all resource contrasts, and named UNAVAILABLE evidence whenever any contributing rep lacks metrics; their focused tests retain the current exact observations.
- [x] #7 comparison-report.ts only assembles validated provenance, quality, and resources into the report contract; comparison-command.ts retains destination-overlap refusal, symlink-safe atomic replacement, deterministic destination selection, and unchanged CLI behavior.
- [x] #8 bun test, bun run typecheck, bun run lint, and bun run fmt:check all exit successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Begin with a characterization seam: use the existing completed comparison fixture to derive the destination through comparisonReportPaths, capture the exact current serialized report text and stdout, and observe the characterization pass before moving code. Then extract the pure leaf first: move buildPairedEstimate and one canonical name/minuend/subtrahend contrast table to comparison-estimator.ts, move its focused tests to comparison-estimator.test.ts, and observe the new import fail before adding the module.

Keep comparison-record.ts as the sole schema and wire-format owner and add canonical report serialization there; comparison-command.ts remains the I/O orchestrator and atomic writer. Reduce comparison-evidence.ts to the immutable evidence types shared across boundaries. Move manifest-relative reads, digests, strict group/rep parsing, frozen-file verification, and rep/group consistency to comparison-loader.ts. Move executed-corpus versus controlled-input projection, checkpoint normalization, controlled-input comparisons, report-contract derivation, arm snapshot checks, and the single rep-count rule to comparison-comparability.ts.

Move reliability projection and its focused tests to comparison-quality.ts and comparison-quality.test.ts. Move metric summaries, missing-evidence policy, and resource contrasts to comparison-resources.ts and comparison-resources.test.ts. Both consume the estimator contrast table; neither restates arm pairs or rep-count policy. Leave comparison-report.ts as a thin provenance and schema assembly boundary, then rerun the exact-byte/CLI characterization and all repository gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-02 from ACT-6, its implementation and independent review notes, the comparison source and focused tests, the CLI fixture, docs/design.md decisions 4, 6, and 7, GLOSSARY.md, and the ACT-6 commit sequence.

Unknowns resolved:
- Scope: this is a behavior-preserving decomposition. ACT-6 settled the manifest, report, statistical, provenance, missing-evidence, command, and CLI contracts; no product behavior is reopened.
- External contract: schema version, report field order, JSON indentation, trailing newline, deterministic content-addressed destination, printed path, source immutability, and absence of provider or worktree execution all remain fixed. The current CLI test parses generated JSON and derives its expected stdout from stdout itself, so an exact-byte characterization with an independently derived destination must precede the split.
- Schema and bytes: comparison-record.ts owns both strict manifest/report schemas and canonical serialization. comparison-command.ts owns where and how bytes are safely persisted, not their shape.
- Loading versus policy: comparison-loader.ts owns filesystem facts and contextual evidence validation. comparison-comparability.ts owns the semantic distinction between treatment and controlled inputs, including pipeline checkpoint normalization, and all within-arm, cross-arm, and cross-case comparability policy.
- Statistics: comparison-estimator.ts owns both the clustered estimator and one canonical contrast table. This removes the same three arm pairs currently repeated in quality, resources, and report assembly.
- Rep count: comparability is the one owner because it derives the shared comparison contract from loaded groups before any projection. Quality and resource projection consume that validated contract rather than defending parallel public entry points with repeated rules.
- Projection boundaries: quality and resources change for different reasons and receive separate modules and focused tests. The final report module only joins their outputs with source provenance and validates the external record.
- Compatibility: no compatibility adapter or re-export is needed because all consumers are inside this repository and can move atomically.

Glossary terms added: none. Comparison, comparison arm, benchmark case, corpus snapshot, and rep already cover the model.

First safety test: extend the completed comparison CLI fixture to independently derive the expected report path and compare the full current report text, including its trailing newline, to pinned expected bytes; observe it pass before refactoring. First extraction red: move the paired-estimator specification to comparison-estimator.test.ts, import the not-yet-created module, and observe the missing-module failure before extracting the implementation.

No product decision is deferred.

Build handoff (2026-09-02):
- Changed: characterized the completed two-case, three-arm report bytes and independently derived CLI destination; split record serialization, loading, comparability, paired estimation, quality, resources, and final assembly into their named boundaries.
- Newly possible but not wired: none. All repository callers use comparison-loader.ts and comparison-report.ts; no caller remains on the old mixed comparison-evidence.ts or comparison-report.ts paths.
- Observed: bun test passed 441 tests; bun run typecheck, bun run lint, and bun run fmt:check exited successfully. A final focused test invoked compare-confirmations.ts, observed the independently derived printed report path, matched the pinned full report text, retained source digests, and did not invoke trapped claude or git commands.
- Not verified: no acceptance behavior remains unverified. No paid provider call or real worktree operation was run because the comparison command is required to perform neither.
- Stopped work: the strict lint gate rejected the first single-export module shape; the boundary exports were corrected and all gates rerun. No follow-up task was needed.
- Refactor pass: removed the duplicate contrast-name union; no larger structural opportunity remains.
- Independent review: due because this refactors a CLI and report path other users run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split comparison reporting by boundary without changing its wire format or CLI behavior. The completed fixture now pins report.json byte for byte, the loader and comparability policies are isolated, estimation owns one contrast table, quality and resources have focused specifications, and report assembly only joins validated projections. Observed all 441 tests and every required static gate pass; the real CLI fixture printed the expected digest-derived path without changing evidence or executing external commands.
<!-- SECTION:FINAL_SUMMARY:END -->
