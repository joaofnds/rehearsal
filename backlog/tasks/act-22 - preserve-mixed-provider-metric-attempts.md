---
id: ACT-22
title: preserve mixed provider call evidence
status: Build
assignee: []
created_date: '2026-09-01 09:55'
updated_date: '2026-09-01 14:05'
labels: []
dependencies: []
references:
  - src/benchmark/contracts.ts
  - src/benchmark/workflow.ts
  - src/benchmark/workflow.test.ts
  - src/benchmark/judge-attempt.ts
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/pipeline-confirmation.test.ts
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/confirmation-evidence.ts
  - src/benchmark/confirmation-report.ts
  - GLOSSARY.md
type: bug
ordinal: 15008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Preserve one evidence entry for every worker, Product Owner, and stage-Judge provider call so a missing-metrics call cannot erase available metrics or let an incomplete confirmation rep appear complete.

Workflow and Product Owner accumulation currently collapses the whole call history to undefined when a later provider response omits metrics. Pipeline confirmation also records no missing marker when a later stage-Judge invocation fails before returning JudgeAttempt evidence; an earlier Judge call can then make the role look complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A worker call history and a Product Owner call history that each contain an initial response with metrics followed by a response without metrics preserve both ordered provider calls. When confirmation collects those histories, the rep metrics are MISSING, the available worker and Product Owner metrics remain role-attributed, the missing list contains exactly one entry for each role, and workerTrajectorySteps equals the available worker turns.
- [ ] #2 A two-stage pipeline whose first stage Judge returns metrics and whose second stage Judge invocation fails before returning attempt evidence produces a rep whose metrics are MISSING, retains the first stage-Judge call, and contains exactly one missing stage-Judge call entry.
- [ ] #3 For a rep with mixed provider call evidence, reliability reports retain observed grades and verdicts but count no successful outcome, while resource reports increment missingMetricReps and add neither zeros nor partial distributions for that rep.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the all-or-nothing worker and Product Owner metric histories with an ordered, JSON-safe provider-call evidence shape whose metrics field is optional; keep role attribution at the confirmation boundary.
2. Pass those ordered worker and Product Owner calls through stage and pipeline confirmation without collapsing available entries.
3. At the pipeline stage-Judge invocation boundary, represent a started call with no returned JudgeAttempt as one metric-less provider call; preserve returned accepted or rejected attempts without double-counting.
4. Add producer and pipeline regression tests, then run the focused tests followed by the full format, lint, typecheck, and test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping decisions and resolved unknowns:
- Language: use Provider call for a model-provider invocation; Attempt keeps its existing stage-execution meaning, and Judge attempt remains the validated/rejected Judge response concept. Added Provider call to GLOSSARY.md.
- Evidence model: preserve call order as one entry per invocation with optional metrics. Missing metrics are local to that entry and never erase sibling calls.
- Ownership: workflow and Product Owner producers record their calls; confirmation assigns roles and classifies completeness. Pipeline orchestration records the stage-Judge call that otherwise has no returned JudgeAttempt.
- Test setup: worker and Product Owner mixed histories are exercised independently because two worker turns can yield only one Product Owner answer; confirmation collection then observes both histories together.
- Report policy: unchanged. Incomplete reps retain calls in the durable rep record and observed grades in reliability distributions, but are excluded from successes and resource distributions.
- Compatibility: no migration is required for previously written run or confirmation artifacts; this task changes newly produced in-memory and durable evidence only.
- Open questions: none.

First test to write: extend src/benchmark/workflow.test.ts so createProductOwner answers twice, with metrics in the first envelope and no metrics in the second, and assert its ordered provider-call evidence is [{ metrics: first }, {}]. Follow with the analogous two-turn worker test before threading the shape into confirmation.
<!-- SECTION:NOTES:END -->
