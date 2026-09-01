---
id: ACT-6
title: report paired comparisons between corpus versions
status: Shape
assignee: []
created_date: '2026-08-30 12:43'
updated_date: '2026-09-01 10:30'
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
Compare two corpus versions by running both from identical checkpoints and reporting paired per-task deltas with standard errors, stage by stage, always beside a no-corpus (or minimal-corpus) control arm, with cost and trajectory length beside quality so verbosity can never score as improvement. See docs/design.md decisions 6-7; evidence in docs/research.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison runs two corpus versions from identical checkpoints and reports paired per-task score deltas with standard errors, per stage.
- [ ] #2 Every comparison includes the control arm, and reports cost, tokens, and trajectory steps beside quality for each arm.
- [ ] #3 A comparison across mismatched lineages is refused.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping started 2026-09-01.

Provisional goal: compare baseline and candidate corpus evidence over the same benchmark cases, with a mandatory minimal-corpus control, so quality gains and resource regressions are visible together.

Repository facts observed:
- ACT-5 executes one confirmation group for one task/checkpoint and one frozen corpus. Its strict group and rep records already contain stage/final binary outcomes, raw grades, role-attributed cost and tokens, worker trajectory turns, elapsed time, model/effort, source or checkpoint lineage, and hashes of every frozen input.
- There is no comparison command, comparison artifact, benchmark-suite manifest, arm role, variant name, or durable case identifier. A task is recoverable only from the frozen task file referenced by a confirmation group.
- Stage and full-pipeline confirmations can already be produced independently. The design path names ACT-6 as comparison reporting; variant-matrix execution and its projected-cost preview are explicitly later work.
- A control-repository commit is not sufficient to identify the corpus today: CLAUDE.md is tracked here, but stage and global skills are captured from installed skill roots outside this repository. The durable corpus identity that exists is the frozen per-stage file snapshot and its hashes.
- ACT-4 lineage checks compare an attempt own corpus/model/effort. ACT-6 must distinguish the intended corpus difference from confounds: arms may differ in corpus bytes, but must match in task/checkpoint or source, pipeline, rubrics, worker and Judge models/efforts, budgets, and every other frozen input.
- The cited statistical method treats repeated answers to one question as resamples: average reps within each task/checkpoint first, pair arms on that task-level score, then compute the mean difference and its CLT standard error across task-level paired differences. Rep ordinals are not pairs, and pooling all reps as independent observations understates uncertainty.

Language needing João approval:
- Comparison run: one immutable report over matched confirmation evidence.
- Arm: baseline, candidate, or control corpus evidence for every benchmark case.
- Benchmark case: one frozen task plus source/checkpoint and all non-corpus inputs; the clustering and pairing unit.
- Corpus snapshot: the exact frozen CLAUDE.md and skill bytes an arm ran.

Open decisions:
1. Whether ACT-6 only consumes completed confirmation groups or also launches every paid arm.
2. Whether the mandatory control is an explicit user-provided minimal corpus snapshot or a harness-authored empty/minimal corpus.
3. Whether comparisons require at least two benchmark cases so the across-case paired standard error is defined.
4. Whether the report computes candidate-minus-baseline only while showing the control raw, or computes all three pairwise contrasts.

No implementation plan or acceptance rewrite is final until these decisions are answered.
<!-- SECTION:NOTES:END -->
