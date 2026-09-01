---
id: ACT-6
title: report paired comparisons between corpus versions
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-09-01 11:30'
labels: []
dependencies:
  - ACT-4
  - ACT-5
references:
  - docs/design.md
  - docs/research.md
modified_files:
  - compare-confirmations.ts
  - package.json
  - README.md
  - src/benchmark/checkpoint.ts
  - src/benchmark/comparison-command.ts
  - src/benchmark/comparison-evidence.ts
  - src/benchmark/comparison-evidence.test.ts
  - src/benchmark/comparison-loader.test.ts
  - src/benchmark/comparison-record.ts
  - src/benchmark/comparison-record.test.ts
  - src/benchmark/comparison-report.ts
  - src/benchmark/comparison-report.test.ts
  - src/benchmark/run-layout.ts
  - backlog/tasks/act-23 - split-comparison-reporting-by-boundary.md
ordinal: 6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce a deterministic comparison report from completed confirmation groups. A manifest supplies at least two matched benchmark cases, each with baseline, candidate, and user-provided minimal-corpus control arms. The report shows stage/final quality and all three paired arm contrasts with across-case standard errors, alongside cost, token, and trajectory evidence. Comparison never launches paid sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A CLI test runs the comparison command with a manifest containing two benchmark cases and exactly baseline, candidate, and control confirmation-group paths; it starts no provider session or worktree, leaves every source artifact byte-identical, writes a strict versioned report under the comparison layout, and prints that report path.
- [x] #2 Manifest-boundary tests observe rejection before report creation when the control arm is absent, a case ID is duplicated, fewer than two cases are supplied, a referenced group or rep record is missing or invalid, or the groups disagree on mode, declared stages, or requested rep count; each error names the case, arm, and offending field.
- [x] #3 Comparability tests observe that each case accepts different executed corpus bytes across its three arms only when source or consumed-checkpoint lineage, task, product brief, pipeline, rubrics, worker and Judge model/effort, budget, and every other non-corpus frozen input match; a mismatch is refused with both arms and the differing input named. Across cases, each arm must retain one executed corpus snapshot and all cases must retain one reportable mode/stage contract.
- [x] #4 For every declared stage, and for final outcome in pipeline mode, a two-case fixture reports each arm requested, attempted, not-reached, failed, and successful counts, raw grade distribution, success rate, existing within-case standard error, and pass^k; it reports candidate-minus-baseline, candidate-minus-control, and baseline-minus-control task-level deltas plus the mean delta and CLT standard error across cases.
- [x] #5 A focused estimator test averages reps within each case and arm before taking arm differences, then computes sample standard deviation of the case deltas divided by sqrt(case count); exact fixture values are asserted, permuting rep ordinals leaves the report unchanged, and pooling reps or pairing equal ordinals makes the test fail.
- [x] #6 For each case and arm the report shows complete and missing-metric rep counts, per-role and total cost plus input, output, cache-read, and cache-write token summaries, and worker trajectory-turn summaries. It reports all three pairwise contrasts of case-level resource means and their across-case standard errors; any metric missing from a rep makes the affected arm/case and contrast unavailable with the missing evidence named, never zero-valued.
- [x] #7 The report records every case and arm role, the source confirmation group and rep paths with content digests, the executed corpus paths and digests that identify each corpus snapshot, all per-case observations, all aggregate estimates, and the comparison manifest digest, so the reported numbers can be reproduced from the cited frozen evidence.
- [x] #8 bun test, bun run typecheck, bun run lint, and bun run fmt:check all exit successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: turn already-completed confirmation evidence into a reproducible three-arm paired comparison that cannot hide a resource regression behind a quality gain.

Resolved decisions (João approved the recommendations on 2026-09-01):
1. ACT-6 is a reporting boundary. It consumes completed ACT-5 confirmation groups and never launches workers, Product Owners, Judges, or worktrees. Paid multi-variant execution and projected-cost approval remain the later variant-matrix capability named in docs/design.md.
2. Every benchmark case has exactly three comparison arms: baseline, candidate, and a user-provided minimal-corpus control. The harness requires and records the control role and its exact frozen bytes; it does not invent an empty corpus that could not execute the declared skill.
3. A benchmark case is the independent pairing and clustering unit: one frozen task plus source or consumed checkpoint and every non-corpus input. A comparison requires at least two cases. Within each arm and case, rep outcomes are averaged first; arm differences are then taken case by case; the reported comparison estimate is the mean case difference with CLT standard error sampleSD(differences) / sqrt(caseCount). Rep ordinals carry identity only and are never paired.
4. Every report computes candidate-minus-baseline, candidate-minus-control, and baseline-minus-control. The same direction and case pairing apply to success rate, pass^k, total cost, each token bucket, and worker trajectory turns.
5. Corpus differences are the treatment, not a lineage error. Within one case, source or consumed-checkpoint lineage, task, product brief, pipeline, rubrics, mode/stages, rep count, worker and Judge model/effort, budget, and all other non-corpus frozen inputs must match. Across cases, each arm must use one executed corpus snapshot and the reportable mode/stage contract must stay fixed.
6. Existing confirmation records do not attribute provider calls to individual stages in a full pipeline. The comparison therefore reports quality per stage/final outcome and resource evidence at confirmation-group scope (or selected-stage scope for stage mode), without inventing per-stage resource attribution. Missing provider metrics remain missing: quality retains the ACT-5 unsuccessful outcome, resource contrasts become unavailable where evidence is incomplete, and no missing value becomes zero.

Interfaces likely to move:
- Add a strict versioned comparison-manifest schema. Paths are resolved relative to the manifest and each case structurally requires baseline, candidate, and control group records.
- Add a loader at the filesystem boundary that parses the existing strict confirmation group and referenced rep records, hashes the cited files, and projects them into domain evidence. Derived ACT-5 report.json is not trusted as source data; comparison statistics are recomputed from rep records.
- Add a comparability projection that separates executed corpus files from controlled inputs. In stage mode the executed snapshot is the selected stage corpus; upstream corpus captured only for staleness evidence is not mislabeled as treatment. In pipeline mode every declared stage corpus belongs to the snapshot.
- Keep statistics in a pure comparison-report builder: per-case arm summaries, task-level pair differences, mean differences, and across-case standard errors for quality and complete resource evidence.
- Add a strict versioned comparison report and a small CLI adapter that loads one manifest, builds and writes one report under .benchmark-runs/comparisons, and prints its path. Extend the shared run-layout boundary for that destination.

Deliberately unchanged: confirmation execution and schemas, confirmation cost approval, replay staleness behavior, Judge grading rules, the user-authored contents of the minimal control, variant matrices, model/effort comparisons, power analysis, confidence-interval policy, and a rendered UI.

Glossary terms added: Comparison, Comparison arm, Benchmark case, Corpus snapshot. docs/design.md now identifies a variant by corpus snapshot rather than by a control-repository commit alone.

First test to write: drive the pure estimator with two cases, three arms, and two binary reps per arm. Choose outcomes whose candidate-minus-baseline success-rate deltas are 0.5 and 1.0, and observe mean delta 0.75 with standard error 0.25; then reverse every rep order and observe the identical report.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped from docs/vision.md, docs/design.md decisions 4, 6, and 7, docs/research.md, the completed ACT-4 and ACT-5 cards, GLOSSARY.md, confirmation-record.ts, confirmation-report.ts, confirmation-evidence.ts, replay-confirmation.ts, pipeline-confirmation.ts, run-layout.ts, and the existing CLI boundaries.

Unknowns resolved:
- Comparison reports completed groups rather than executing a matrix. The design sequence calls this step comparison reporting and explicitly leaves variant-matrix execution and its projected-cost preview for later.
- Corpus identity is the frozen bytes actually used, not a control Git SHA. CLAUDE.md is tracked here but installed stage/global skills are captured from external skill roots, so a commit cannot identify the whole treatment.
- The mandatory control is explicit evidence supplied by the user. A no-file corpus cannot invoke the pipeline skill; the reporter can enforce the control role and provenance without pretending to judge whether its contents are minimal.
- Repeated reps are resamples within a task/checkpoint, not independent benchmark cases and not ordinal pairs. The cited method says to average resamples at question level before paired inference; at least two cases are required so sample variance and its standard error are defined.
- The ACT-4 attempt guard answers a different question: debug attempts with different execution inputs are incomparable. ACT-6 deliberately varies the executed corpus while requiring source/checkpoint lineage and every non-corpus input to match.
- Full-pipeline rep records flatten provider metrics by role and do not retain stage attribution. This task reports those resource measures honestly at group scope instead of expanding the confirmation artifact contract or assigning calls to stages by guesswork.
- Missing resource evidence cannot support a numeric contrast. The report marks the affected arm/case and contrast unavailable while preserving quality outcomes and evidence provenance.

All decisions are resolved. No question is deferred.

Build handoff 2026-09-01:
- Added the strict three-arm comparison manifest, frozen-evidence loader, controlled-input and corpus-snapshot guards, case-clustered paired estimator, strict reproducible report, comparison layout, and read-only CLI. Quality covers every declared stage and pipeline final outcome; resources preserve per-role and total distributions and mark incomplete evidence unavailable.
- TDD observations included missing estimator/schema/loader/report/command boundaries before their implementations, exact 0.75/0.25 clustered estimates, a rep-order mutation that killed ordinal pairing, contextual boundary failures, and strict report parsing.
- Direct CLI observation trapped git and claude, hashed the source fixture before and after, parsed the emitted report, and observed one deterministic `.benchmark-runs/comparisons/<manifest-sha>/report.json` path with byte-identical source evidence and no external-call marker. No paid provider session or worktree execution was run.
- Refactor pass centralized the shared rep-count invariant. The larger comparison boundary split is deliberately tracked in ACT-23; no other small structural change remained. Nothing is implemented but unwired, no decision is open, and work stopped on nothing.
- Fresh final verification: `bun test` observed 354 pass, 0 fail, and 738 assertions. `bun run typecheck`, `bun run lint`, and `bun run fmt:check` all exited successfully.

Independent review, 2026-09-01
--------------------------------
One fresh reviewer examined every changed file across style, architecture, spec conformance, security, testing, and refactoring; no axis was skipped. It reported three blocking findings, all verified and fixed in 24619b9:
1. [blocking, correctness/spec, FIXED] Pipeline comparison excluded every checkpoint file, allowing changed consumed workflow state. The loader now normalizes only the corpus-derived checkpoint identities (`targetSha`, `lineage`, and `upstream`) while comparing checkpoint stage, model/effort, corpus/artifact lists, workflow-state contract, and every other checkpoint file. Integration tests accept derived identities and reject changed workflow state.
2. [blocking, correctness/security, FIXED] A report destination could overlap source evidence or follow a pre-existing destination symlink. The loader retains canonical paths for the manifest, groups, reps, and frozen inputs; the command rejects an overlapping destination and writes a sibling temporary file followed by atomic rename. Tests observe source bytes unchanged on overlap and a symlink replaced without changing its target.
3. [blocking, testing, FIXED] Controlled-input, contrast, and resource requirements were under-pinned. Parameterized guards now cover lineage, every controlled scalar and frozen-file category, plus a contract change in another case/arm. Exact estimates are asserted for all three quality contrasts, every resource metric and worker turns, per-role observations, all three numeric resource contrasts, and named missing evidence.
No style or additional architecture/refactoring findings remained; ACT-23 already owns the size-driven split. The review is closed with every finding disposed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built deterministic, read-only three-arm paired comparison reporting from frozen confirmation evidence. The strict CLI validates complete source provenance and controlled inputs, permits only the executed corpus treatment to differ, computes case-clustered quality and resource contrasts, propagates missing metrics as unavailable, and writes an atomic content-addressed report without provider or worktree execution. Independent review found three blocking evidence-safety and coverage issues; all were fixed in 24619b9 and verified. Final gates: 354 tests passed with 738 assertions; typecheck, lint, and format check passed. ACT-23 tracks the only deferred structural split.
<!-- SECTION:FINAL_SUMMARY:END -->
