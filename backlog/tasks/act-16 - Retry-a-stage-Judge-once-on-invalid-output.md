---
id: ACT-16
title: Retry a stage Judge once on invalid output
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 23:30'
updated_date: '2026-08-31 11:06'
labels: []
dependencies: []
ordinal: 8008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stage Judge that returns schema-valid output with an invalid evidence citation (or otherwise fails validation in validateStageJudgeEvidence/deriveStageGrade) currently kills the whole run as STAGE_JUDGE_FAILED, discarding a paid engineering session (observed 2026-08-31: shape stage succeeded, Judge cited task-state:task.status, run died). Add one retry of the Judge call against the same frozen input before declaring STAGE_JUDGE_FAILED, recording both attempts and their costs in the stage file. Same consideration for the final Judge in judge.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a stage Judge's first returned payload fails structured-output parsing, evidence validation, or grade derivation and its second payload is valid, exactly two calls use the same frozen evidence and rubric; the second prompt names the first rejection, and the stage file records both payloads, per-call costs, validation outcomes, and their aggregate cost.
- [x] #2 When both stage Judge payloads fail validation, no third call occurs and the STAGE_JUDGE_FAILED stage file retains the frozen input, original prompt, both returned payloads, both per-call costs, and both validation errors.
- [x] #3 Stage replays and calibration rejudges retain the same per-attempt stage scorecard evidence as an original run.
- [x] #4 When a final Judge's first payload fails validation and its second is valid, exactly two calls use the same frozen candidate evidence and rubric; the completed run artifact records both payloads, per-call costs, validation outcomes, and their aggregate cost.
- [x] #5 When both final Judge payloads fail validation, no third call occurs and a FAILED main run artifact retains the candidate evidence, completed workflow and stage scorecards, original Judge prompt, both returned payloads, both per-call costs, and both validation errors.
- [x] #6 A command, timeout, or Claude-envelope failure is not retried and retains the existing failure behavior.
- [x] #7 Stage files, replay records, and main run artifacts written before Judge-attempt records were introduced remain readable by current consumers.
- [x] #8 bun test, bun run typecheck, bun run lint, and bun run fmt:check pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: preserve the work and cost of invalid Judge responses while giving both stage and final Judges one bounded correction attempt against frozen evidence.

Known starting point:
- runStageJudge already retries one structured-output/evidence/grade-validation rejection, sends the rejection in the correction prompt, and reports aggregate cost. Commit 59ceacb delivered this partial behavior.
- Stage scorecards retain only the accepted grade and aggregate cost. STAGE_JUDGE_FAILED retains only frozen input and the final error.
- runJudge has no retry or cost result. The main run artifact is not created until the final Judge succeeds.

Resolved decisions (Joao, 2026-08-31):
1. The final Judge gets the full durability contract. Two invalid final payloads produce a FAILED main run artifact carrying the candidate evidence and both attempts.
2. Each Judge attempt records the returned Judge payload, call cost, and accepted/rejected validation outcome. The shared frozen input and original prompt remain single fields rather than being duplicated into every attempt.
3. Only returned output rejected by harness validation is retried. Command, timeout, and Claude-envelope failures are not retried.
4. Existing aggregate Judge cost fields remain sums across calls for current consumers, and persisted pre-change artifacts remain readable.

Design:
- Introduce one Judge-attempt record shared by stage and final grading: returned payload, call cost, and an accepted outcome or rejected outcome with the validation error. Keep the original prompt and frozen evidence on the enclosing scorecard/artifact.
- A Judge-output validation error carries the attempts accumulated so failure writers can persist evidence after the second rejection. It is distinct from invocation/envelope failures, preserving the retry boundary.
- StageScorecard gains attempt records while keeping costUsd as the aggregate. Original stage files, replay scorecards, and calibration scorecards receive the field through runStageJudge. STAGE_JUDGE_FAILED also receives the original prompt and failed attempts. Readers treat the field as optional for legacy files.
- runJudge uses the same two-attempt validation loop and returns aggregate cost plus attempts. Successful run artifacts retain them. Before invoking the final Judge, assemble enough of the main artifact to write a FAILED variant if both payloads are invalid; that variant omits a grade but retains candidate evidence, completed workflow, stage scorecards, prompt, attempts, and failure reason. Existing post-grade FAILED artifacts remain valid.
- Update the documented run-artifact behavior to describe retry and durable failed final judging.

Acceptance as observations is recorded in the task acceptance criteria.

First test to write: script runStageJudge with an invalid payload followed by a valid payload and assert that its returned scorecard contains two attempt records with the exact payloads, individual $0.10 costs, REJECTED/ACCEPTED outcomes, the first validation error, and aggregate cost $0.20. Observe it fail because StageScorecard currently has no attempts.

Glossary: added Judge attempt (2026-08-31).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-08-31.

The task began after six citation-format failures. Commit 59ceacb already supplied the bounded stage retry and aggregate cost, so Build starts from that partial implementation rather than replacing it. Repository inspection confirmed that durable attempt evidence, final-Judge retry, and final-Judge failure artifacts remain unimplemented.

No open product decisions remain.

Build handoff (2026-08-31):

Changed: stage and final Judges share one two-attempt output-validation protocol. Scorecards and run artifacts retain each returned payload, per-call cost, validation outcome, original prompt, and aggregate cost. Exhausted stage validation persists STAGE_JUDGE_FAILED evidence; exhausted final validation writes a grade-less FAILED main artifact with the completed workflow and frozen candidate evidence. Original stage files, replays, and calibration rejudges preserve attempt records.

Available but not wired: none. Original runs, stage replays, stage calibration rejudges, and final original judging use the new path; no caller remains on the old retry implementation.

Observed: focused tests saw invalid-then-valid and invalid-twice flows make exactly two calls, invocation and Claude-envelope failures make one call, adversarial rejection text remain JSON-escaped as untrusted data, and failed final grading write the main artifact. The full `bun test` run passed 236 tests; `bun run typecheck`, `bun run lint`, `bun run fmt:check`, and `git diff --check` passed.

Not verified: no paid live Claude benchmark run was executed.

Refactor: the duplicated stage/final retry loop was replaced by the shared runJudgeAttempts protocol. No larger structural task remains.

Independent review: completed because untrusted Judge output and paid-call evidence are security- and durability-surfaced. All axes applied. Blocking security finding at src/benchmark/judge-attempt.ts (rejection text could become retry instructions): fixed with explicitly untrusted JSON feedback and an adversarial test. Should-fix testing finding at src/benchmark/run.ts (failed final artifact write was unpinned): fixed with runFinalJudge and a filesystem orchestration test. Should-fix style finding at src/benchmark/judge-attempt.ts (same-type constructor arguments could transpose): fixed with a readonly props object. No findings remained undisposed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and observed bounded Judge correction retries with durable per-attempt evidence for stage, replay, calibration, and final run artifacts. Two harness-invalid outputs now preserve both paid responses and errors; invocation and Claude-envelope failures remain single-call failures. Independent review found three issues, all fixed. Full suite: 236 passed; typecheck, lint, and format checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
