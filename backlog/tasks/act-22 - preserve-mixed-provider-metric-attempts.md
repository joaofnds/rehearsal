---
id: ACT-22
title: preserve mixed provider metric attempts
status: To Do
assignee: []
created_date: '2026-09-01 09:55'
labels: []
dependencies: []
references:
  - src/benchmark/workflow.ts
  - src/benchmark/judge-attempt.ts
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/confirmation-evidence.ts
type: bug
ordinal: 15008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Confirmation can only classify attempt evidence it receives. Workflow and Product Owner metric accumulation currently collapses the whole history to undefined when a later call omits metrics, and a stage-Judge invocation that fails before returning attempt evidence can leave an attempted call unmarked. Preserve available calls and explicit missing attempts at those producer boundaries so confirmation records cannot report incomplete execution as complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A multi-turn worker and Product Owner whose first call reports metrics and second call does not produce confirmation evidence that retains both first-call metrics, records one missing attempt per role, and keeps the available worker turns.
- [ ] #2 A two-stage pipeline whose first stage Judge returns metrics and whose second stage Judge invocation fails records the second attempted Judge call as missing, retains the first Judge call, and cannot classify the rep metrics as COMPLETE.
- [ ] #3 Reliability and resource reports continue to exclude metric-incomplete reps from success and zero-valued resource evidence while retaining every available role-attributed call.
<!-- AC:END -->
