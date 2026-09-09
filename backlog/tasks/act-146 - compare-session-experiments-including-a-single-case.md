---
id: ACT-146
title: compare session experiments including a single case
status: To Do
assignee: []
created_date: '2026-09-09 15:49'
labels: []
dependencies:
  - ACT-140
  - ACT-143
  - ACT-144
  - ACT-145
references:
  - src/benchmark/comparison-estimator.ts
  - src/benchmark/comparison-quality.ts
  - src/benchmark/comparison-loader.ts
  - src/benchmark/comparison-record.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 142008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The comparison estimator requires at least two distinct cases and computes uncertainty across case means. Six repetitions of one triage fixture therefore cannot use the existing comparison unchanged. comparison-quality also routes a session through the pipeline final-outcome branch. Add session evidence loading and reporting, including a valid one-case experiment with repeated runs, while preserving the multi-case path.

Show named check outcomes and partial scores beside whole-task success and pass^k. An 18/19 result and a 10/19 result currently share the same unsuccessful aggregate. Keep baseline, candidate and no-skill or minimal-corpus control roles explicit; removing triage for the control must retain the shared non-treatment inputs. Refuse incompatible fixture, model, effort, settings or grading definitions. The supported comparison may vary corpus bytes intentionally; it must verify the shared inputs rather than demand identical full lineage hashes.

Choose and justify the single-case estimator during shaping. A case's correlated checks are not independent cases; pairing arbitrary rep ordinals does not establish matched random inputs. Report the sampling unit and uncertainty appropriate to it. Coordinate grade presentation with ACT-102 and ACT-109. First verification target: one session case with three arms, differing partial scores, repeated observations and no pipeline final judge. The integration example should use a small generated board fixture and external scorer to exercise the approved workflow without requiring the original my.files harness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison of repeated session runs for one case and baseline, candidate and control arms produces a report without inventing a second case or pipeline final outcome (João’s approved session benchmark scope, doc-59)
- [ ] #2 The report distinguishes partial scores such as 18/19 and 10/19 and names the failing checks alongside whole-task success and pass^k (João’s approved session benchmark scope, doc-59)
- [ ] #3 The report states its sampling unit and estimates uncertainty for that unit without treating checks or arbitrarily paired rep ordinals as independent cases (João’s approved session benchmark scope, doc-59)
- [ ] #4 A comparison with a missing control arm or mismatched shared fixture, model, effort, settings or grading identity is refused with the incompatible input named (João’s approved session benchmark scope, doc-59)
- [ ] #5 Existing valid multi-case comparisons retain their paired per-case interpretation (João’s approved session benchmark scope, doc-59)
- [ ] #6 A generated board case runs through setup, frozen skill variants, state scoring, repetitions and a three-arm comparison using declared case data (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->
