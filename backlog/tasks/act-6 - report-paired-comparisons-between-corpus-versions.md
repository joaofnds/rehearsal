---
id: ACT-6
title: report paired comparisons between corpus versions
status: Build
assignee: []
created_date: '2026-08-30 12:43'
updated_date: '2026-09-01 10:36'
labels: []
dependencies:
  - ACT-4
  - ACT-5
references:
  - docs/design.md
  - docs/research.md
ordinal: 6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce a deterministic comparison report from completed confirmation groups. A manifest supplies at least two matched benchmark cases, each with baseline, candidate, and user-provided minimal-corpus control arms. The report shows stage/final quality and all three paired arm contrasts with across-case standard errors, alongside cost, token, and trajectory evidence. Comparison never launches paid sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A CLI test runs the comparison command with a manifest containing two benchmark cases and exactly baseline, candidate, and control confirmation-group paths; it starts no provider session or worktree, leaves every source artifact byte-identical, writes a strict versioned report under the comparison layout, and prints that report path.
- [ ] #2 Manifest-boundary tests observe rejection before report creation when the control arm is absent, a case ID is duplicated, fewer than two cases are supplied, a referenced group or rep record is missing or invalid, or the groups disagree on mode, declared stages, or requested rep count; each error names the case, arm, and offending field.
- [ ] #3 Comparability tests observe that each case accepts different executed corpus bytes across its three arms only when source or consumed-checkpoint lineage, task, product brief, pipeline, rubrics, worker and Judge model/effort, budget, and every other non-corpus frozen input match; a mismatch is refused with both arms and the differing input named. Across cases, each arm must retain one executed corpus snapshot and all cases must retain one reportable mode/stage contract.
- [ ] #4 For every declared stage, and for final outcome in pipeline mode, a two-case fixture reports each arm requested, attempted, not-reached, failed, and successful counts, raw grade distribution, success rate, existing within-case standard error, and pass^k; it reports candidate-minus-baseline, candidate-minus-control, and baseline-minus-control task-level deltas plus the mean delta and CLT standard error across cases.
- [ ] #5 A focused estimator test averages reps within each case and arm before taking arm differences, then computes sample standard deviation of the case deltas divided by sqrt(case count); exact fixture values are asserted, permuting rep ordinals leaves the report unchanged, and pooling reps or pairing equal ordinals makes the test fail.
- [ ] #6 For each case and arm the report shows complete and missing-metric rep counts, per-role and total cost plus input, output, cache-read, and cache-write token summaries, and worker trajectory-turn summaries. It reports all three pairwise contrasts of case-level resource means and their across-case standard errors; any metric missing from a rep makes the affected arm/case and contrast unavailable with the missing evidence named, never zero-valued.
- [ ] #7 The report records every case and arm role, the source confirmation group and rep paths with content digests, the executed corpus paths and digests that identify each corpus snapshot, all per-case observations, all aggregate estimates, and the comparison manifest digest, so the reported numbers can be reproduced from the cited frozen evidence.
- [ ] #8 bun test, bun run typecheck, bun run lint, and bun run fmt:check all exit successfully.
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
<!-- SECTION:NOTES:END -->
