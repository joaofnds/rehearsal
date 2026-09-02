---
id: ACT-7
title: accumulate judge-vs-human agreement from calibration
status: Shape
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-09-02 13:33'
labels: []
dependencies: []
references:
  - docs/design.md
  - docs/research.md
ordinal: 7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Calibration findings (CAUGHT, MISSED, FALSE_POSITIVE) are human labels of Judge decisions. Accumulate them per rubric across runs into a running judge-vs-human agreement figure, shown in reports, and re-baselined whenever the judge model changes. This measures judge drift instead of suspecting it. See docs/design.md decision 8; evidence in docs/research.md 'Judge reliability'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every calibration finding is accumulated per rubric across runs, keyed by the judge model that produced the original grade.
- [ ] #2 An agreement figure per rubric is computed from the accumulated labels and shown in run reports.
- [ ] #3 A judge-model change starts a new baseline; figures from different judge models are never merged.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping evidence gathered 2026-09-02:

- `docs/research.md` names Cohen's kappa and approximately 100 human-labeled examples per rubric as the reliability method; the task currently says only "agreement figure."
- A completed calibration records `CAUGHT`, `MISSED`, and `FALSE_POSITIVE` findings, and the prompt requires every finding, but it does not explicitly label rubric decisions with no finding. Kappa needs both agreement and disagreement observations.
- Stage hard blockers and requirements already reduce to PASS/FAIL; stage dimensions use A/B versus C/D/F in calibration validation; final requirements are PASS/FAIL. The existing data can therefore form binary Judge/human observations if no finding is defined as human agreement with the original decision.
- The project glossary defines Rubric as the whole frozen grading contract, while findings identify individual rubric IDs. "Per rubric" is therefore ambiguous between a contract and a criterion.
- Every current run manifest and final run artifact records the exact `judgeModel`. Stage-stop records carry the workflow `model`, but can be joined to their neighboring manifest in current runs. Runs before manifests cannot establish their Judge model and must not be inferred.
- Human calibration occurs only in single debug runs. The named report outputs are confirmation and comparison reports; a calibrated debug run instead ends in either a completed stage record or completed final run artifact.
- A rubric is commonly revised during calibration. Aggregating only by model and rubric ID merges decisions made under materially different rubric text.

Open product decisions:
1. Observation and statistic: whether every reviewed rubric decision is a label, with an absent Judge-related finding meaning agreement, so the report can show Cohen's kappa plus raw contingency counts; or whether only explicit findings count, which permits only a selected-finding agreement rate. Recommendation: use every reviewed decision, kappa, and counts to match the adopted research method.
2. Baseline identity: whether the baseline is keyed only by exact Judge model, as the current card says, or by exact Judge model plus the frozen rubric contract. Recommendation: include the rubric-content digest so a prompt change cannot be mistaken for model drift; retain the rubric ID inside that contract for per-criterion rows.
3. Presentation scope: whether Judge agreement appears only on calibrated debug-run records, or also beside automated grades in confirmation and comparison reports. Recommendation: include the same read-only snapshot in completed debug-run, confirmation, and comparison reports so every interpreted Judge result carries its reliability context.
4. Historical artifacts: whether current manifest-associated stage calibrations are included even though their stage record lacks `judgeModel`. Recommendation: join current stage records to their exact manifest, skip pre-manifest records with an explicit skipped count, and never infer the model.
<!-- SECTION:NOTES:END -->
