---
id: ACT-22.1
title: carry provider calls across thrown execution boundaries
status: Done
assignee:
  - '@claude'
created_date: '2026-09-01 14:48'
updated_date: '2026-09-01 18:15'
labels: []
dependencies: []
references:
  - src/benchmark/contracts.ts
  - src/benchmark/workflow.ts
  - src/benchmark/workflow.test.ts
  - src/benchmark/judge-attempt.ts
  - src/benchmark/judge.test.ts
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/pipeline-confirmation.test.ts
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/replay-confirmation.test.ts
modified_files:
  - src/benchmark/workflow.ts
  - src/benchmark/workflow.test.ts
  - src/benchmark/judge-attempt.ts
  - src/benchmark/judge-execution-error.ts
  - src/benchmark/judge.test.ts
  - src/benchmark/stage-grading.test.ts
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/pipeline-confirmation.test.ts
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/replay-confirmation.test.ts
parent_task_id: ACT-22
type: bug
ordinal: 19008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Preserve every completed provider call when worker or Judge execution fails after earlier calls, while representing the call that failed before producing evidence as one metric-less Provider call.

Today runWorkflowStage and runJudgeAttempts keep their histories in local arrays and throw errors that do not carry them. Confirmation therefore cannot retain earlier call metrics, and replay confirmation also replaces completed worker and Product Owner histories with generic stage evidence when a stage Judge fails with an ordinary invocation error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A worker whose first provider response has metrics and whose next provider invocation, envelope read, or structured-output read fails exposes a typed workflow execution failure with the two ordered Provider calls: the first with metrics and the failed call without metrics. Diagnostic pipeline confirmation retains the available worker metrics and reports the rep metrics as MISSING.
- [x] #2 A Judge whose first response is rejected with metrics and whose retry invocation fails exposes a typed Judge execution failure with the two ordered Provider calls: the rejected call with metrics and the failed call without metrics. The rejected Judge attempt remains available and no third invocation occurs.
- [x] #3 Replay confirmation whose worker and Product Owner completed with Provider calls before an ordinary stage-Judge invocation failure writes a diagnostic rep that retains both completed histories, adds exactly one missing stage-Judge call, reports the rep metrics as MISSING, and derives workerTrajectorySteps from the retained worker metrics.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add role-specific typed execution failures at the producer boundaries. A workflow failure carries earlier successful worker calls plus one metric-less call when the current invocation, envelope read, or structured-output read fails. A Judge execution failure carries prior rejected attempts, their cost and prompt context, plus one metric-less call when the current invocation or envelope read fails.
2. Consume those typed call histories in pipeline and replay confirmation. Keep role attribution in confirmation, preserve the Product Owner snapshot already available there, and do not infer or double-count calls when the producer supplied evidence.
3. Make replay diagnostic settlement evidence-aware after stage execution starts: use retained worker, Product Owner, and stage-Judge calls for worker or Judge failures, while leaving pre-stage setup failures on the existing generic stage-evidence diagnostic.
4. Add producer contract regressions first, then durable pipeline and replay confirmation regressions. Run the focused tests followed by format checking, lint, type checking, and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping decisions and resolved unknowns:
- Language: Provider call and Judge attempt already exist in GLOSSARY.md. Execution failure is an implementation boundary, not a new domain term, so no glossary entry is added.
- Failure taxonomy: a rejected Judge response remains a Judge attempt because it returned parseable call evidence. An invocation or envelope failure is a typed Judge execution failure. A worker invocation, envelope, or structured-output failure is a typed workflow execution failure because no StageTranscript can be returned.
- Placeholder rule: append exactly one metric-less Provider call only for the current call that failed before producer evidence was returned. Preserve all earlier calls in order. A terminal Judge validation rejection keeps its existing JudgeOutputValidationError and attempts without an extra placeholder.
- Ownership: producers carry their local histories on the typed error; confirmation only assigns roles and classifies completeness. This avoids reconstructing completed calls from orchestration flags.
- Product Owner scope: a Product Owner invocation failure is not added to this card. The settled behavior requires preservation of a completed Product Owner snapshot when a worker or Judge fails.
- Diagnostic scope: pipeline covers the worker failure observation; replay covers the ordinary stage-Judge failure observation. Existing setup-failure diagnostics remain unchanged.
- Compatibility: no durable record schema or migration changes. Only newly produced diagnostic confirmation records gain evidence that is currently discarded.
- Open questions: none.

First test to write: in src/benchmark/workflow.test.ts, script one valid worker QUESTION envelope with complete metrics followed by a rejected provider invocation. Assert that runWorkflowStage rejects with the typed workflow execution failure whose Provider calls equal [{ metrics: firstCall }, {}]. Before running, predict the current test will receive the original invocation Error with no Provider-call history.

Build evidence (2026-09-01):
- RED: workflow producer test failed because WorkflowExecutionError was absent; pipeline and replay durable-record tests then showed completed metrics were discarded; the full suite exposed one stale raw-error expectation in stage grading.
- GREEN: role-specific workflow and Judge execution failures now carry ordered Provider calls; confirmation consumes those histories without double-counting; replay diagnostics retain worker and Product Owner evidence.
- Direct observation: actual runWorkflowStage and runJudgeAttempts calls produced [measured, metric-less] histories; the Judge retained its rejected attempt and stopped after two invocations.
- Refactor pass: no further architectural extraction was justified. The pass did catch and fix budget exhaustion being incorrectly classified as a failed Provider call.
- Verification: oxfmt --check, oxlint --type-aware, tsc --noEmit, and 365 Bun tests passed. No paid external execution was used. Independent review was not triggered: the change is internal, reversible, non-security-sensitive, and schema-compatible.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented producer-owned execution failure evidence for worker and Judge calls. Pipeline and replay confirmation now retain completed role-attributed metrics and add exactly one metric-less call for the failed invocation. Replay diagnostics preserve worker and Product Owner histories and derive trajectory steps from retained worker metrics. Added regressions for invocation, envelope, structured-output, retry, durable confirmation, and pre-invocation budget boundaries.
<!-- SECTION:FINAL_SUMMARY:END -->
