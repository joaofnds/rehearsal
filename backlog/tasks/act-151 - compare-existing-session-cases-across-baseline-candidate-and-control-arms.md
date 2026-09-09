---
id: ACT-151
title: 'compare existing session cases across baseline, candidate and control arms'
status: To Do
assignee: []
created_date: '2026-09-09 16:15'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-7
dependencies:
  - ACT-140
documentation:
  - backlog/docs/doc-61 - Triage-rehearsal-backlog.md
priority: high
ordinal: 147008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-69 already has USD 25 authorized for two session cases, three arms and two reps. ACT-140 can produce the groups, but buildComparisonQuality still sends session reps into the pipeline final-outcome branch and throws. Deliver the smallest existing multi-case session comparison path before the generated-fixture and single-case experiment. This is an independently acceptable slice of ACT-146; that card retains its original six acceptance criteria and gains this prerequisite.

Load actual session input/evidence identities and grade their checks without inventing a pipeline final outcome. Preserve baseline/candidate/control and paired per-case uncertainty. Use provider-free recorded fixtures for this build; ACT-69 owns the paid demonstration. The session record representation must follow ACT-140. No generated fixture, new skill delivery, one-case estimator or regrading is required for this slice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A manifest for two existing session cases with baseline, candidate and control groups of at least two reps produces a comparison report without a pipeline final-outcome error (ACT-69 authorized two-case session-mode run; doc-59 session comparison scope; triage session-probes reproduction in doc-61)
- [ ] #2 The comparison grades session checks and identifies the source groups and repetitions without inventing a pipeline or final judge (doc-59 approved session evidence boundary)
- [ ] #3 Missing control arms and mismatched shared case inputs, model, effort, settings or grading definitions are refused with the incompatible input named (doc-59 approved comparison boundary)
- [ ] #4 Existing valid pipeline and stage multi-case comparisons retain their paired per-case interpretation (ACT-146 AC5, doc-59)
- [ ] #5 Provider-free fixtures prove report production and loading; this implementation starts no paid experiment under ACT-69’s separate budget (ACT-69 budget boundary; doc-59 no additional spend authorization)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: high. Smallest session comparison capability unlocks the existing budgeted m-7 run.

Evidence: session-probes.ts reproduces the session quality rejection; doc-59 and ACT-69 carry the outcome and budget.

Unresolved claims/resources: ACT-140 must establish session group evidence before this implementation.

Next action: Wait for ACT-140, then shape and implement multi-case session evidence loading and quality; preserve ACT-146’s full single-case scope.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
