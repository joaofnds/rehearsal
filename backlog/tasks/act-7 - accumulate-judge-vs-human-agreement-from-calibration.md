---
id: ACT-7
title: accumulate judge-vs-human agreement from calibration
status: Build
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-09-02 13:48'
labels: []
dependencies: []
references:
  - docs/design.md
  - docs/research.md
ordinal: 7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Accumulate completed human calibration into Judge agreement baselines partitioned by exact Judge model and frozen rubric contract, then show those baselines wherever Judge results are reported.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A focused aggregation test converts every original stage or final rubric criterion in each completed calibration into one binary Judge/human observation: CAUGHT is fail/fail, MISSED is pass/fail, FALSE_POSITIVE is fail/pass, an absent Judge-related finding agrees with the original decision, NOT_PROMOTED does not alter a decision, and stage dimensions treat A/B as pass and C/D/F as fail.
- [ ] #2 For six reviews of one criterion producing two pass/pass, two fail/fail, one pass/fail, and one fail/pass observations, the report shows those four raw counts, sample size 6, observed agreement 2/3, and Cohen's kappa 1/3; when expected agreement is 1, kappa is null while counts and observed agreement remain available.
- [ ] #3 Observations with different exact Judge model identifiers, rubric-contract SHA-256 digests, stages, or rubric IDs appear in separate deterministic baselines and are never merged; a rubric edit or Judge-model change therefore starts a new baseline.
- [ ] #4 A stopped stage's completed record persists its exact judgeModel and a Judge agreement snapshot that includes the current calibration; a completed final run artifact does the same for all reviewed stage and final criteria.
- [ ] #5 Historical calibrated stage records without judgeModel are joined only to their exact neighboring run manifest; calibrated pre-manifest records are skipped, never inferred, and increase the report's skipped-calibration count.
- [ ] #6 Stage and pipeline confirmation reports show the accumulated snapshot for their exact Judge model, and omit baselines from other Judge models.
- [ ] #7 A newly generated comparison report is strict schema version 2 and shows the accumulated snapshots for every exact Judge model represented by its source groups; existing strict schema-version-1 comparison reports remain parseable, and unknown fields remain rejected in both versions.
- [ ] #8 The README explains the label mapping, baseline identity, counts, null-kappa case, historical skip behavior, and report locations; GLOSSARY.md defines Judge agreement baseline and rubric criterion.
- [ ] #9 bun test, bun run typecheck, bun run lint, and bun run fmt:check exit successfully, and a generated report is directly observed with separated model/rubric baselines and the expected counts and kappa.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Introduce a focused `judge-agreement` module that parses calibration artifacts at the filesystem boundary with Zod, converts original grades and completed human reviews into binary criterion observations, and folds them deterministically into immutable baseline snapshots. Hash the original parsed stage-rubric contract and exact final-rubric text; derive reports from source run artifacts on demand instead of dual-writing an aggregate store.

Have run completion pass its in-memory current calibration to the collector before the completed stage or final artifact is written, and persist `judgeModel` on future stage records. The collector reads prior top-level run artifacts, joins legacy stage anchors to the exact run manifest, and reports pre-manifest calibrated anchors as skipped.

Add the filtered snapshot to confirmation report finalization. Pass snapshots for the source groups' represented Judge models into comparison report construction, bump generated comparison reports to strict schema version 2, and retain a strict version-1 parser for persisted reports. Document the user-visible interpretation and terms.

First test: drive the pure agreement fold with six observations for one criterion whose contingency cells are 2/2/1/1, and observe sample size 6, agreement 2/3, and kappa 1/3.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping evidence gathered 2026-09-02:

- `docs/research.md` names Cohen's kappa and approximately 100 human-labeled examples per rubric as the reliability method.
- A completed review is authoritative for every original rubric decision because the calibration prompt requires every finding; no Judge-related finding means the human agrees with that original decision.
- Stage hard blockers and requirements are PASS/FAIL; stage dimensions reduce A/B to pass and C/D/F to fail; final requirements are PASS/FAIL.
- João approved the recommendations from the shaping turn by directing Build: use every reviewed decision, partition by exact Judge model plus frozen rubric contract, show snapshots in debug-run/confirmation/comparison outputs, join manifest-associated historical stage records, and skip rather than infer pre-manifest Judge models.
- Human calibration exists only in single debug runs. Confirmation and comparison outputs consume read-only snapshots derived from those run artifacts.

Resolved unknowns:
- Statistic: raw contingency counts, sample size, observed agreement, and Cohen's kappa. Kappa is null when expected agreement is 1 because the denominator is zero.
- Baseline identity: exact Judge model, stage (`final` included), and SHA-256 of the original frozen rubric contract. Criterion summaries remain separate by rubric ID inside that baseline.
- Persistence: source calibrations remain the system of record; reports derive snapshots on demand, avoiding a second mutable store and partial-update risk.
- Presentation: completed stopped-stage records, completed final run artifacts, confirmation reports, and comparison reports.
- History: a stage record without judgeModel may use only its exact neighboring manifest; no manifest means an explicit skipped calibration.
- Compatibility: newly generated comparison reports use schema version 2; persisted strict version-1 reports remain readable.

Glossary terms to add: Judge agreement baseline; rubric criterion.

No product decision remains open.
<!-- SECTION:NOTES:END -->
