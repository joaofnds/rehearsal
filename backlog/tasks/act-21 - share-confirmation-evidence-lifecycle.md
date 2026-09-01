---
id: ACT-21
title: share confirmation evidence lifecycle
status: Build
assignee: []
created_date: '2026-08-31 22:10'
updated_date: '2026-09-01 08:43'
labels: []
dependencies: []
references:
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/confirmation-record.ts
  - run-benchmark.test.ts
type: task
ordinal: 14008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-5 exposed duplicated frozen-file enumeration, metric completeness, rep failure recording, report persistence, and cleanup policy in replay-confirmation.ts and pipeline-confirmation.ts. The copies have already diverged. Extract shared functions for those stable policies while keeping stage-specific and pipeline-specific orchestration direct.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Source inspection observes replay-confirmation.ts and pipeline-confirmation.ts calling one shared frozen-file writer and recursive byte-hashing enumerator, with group-relative paths and deterministic path order; neither orchestrator defines its own copy.
- [ ] #2 A focused metrics-classification test supplies required worker, Product Owner, stage-Judge, and optional final-Judge attempts with both present and absent provider metrics, and observes MISSING status, every available call retained under its role, one missing reason per metric-less required attempt, and worker turns summed only from available worker calls.
- [ ] #3 A two-stage pipeline confirmation test gives the first worker call metrics and the second no metrics, and observes an unsuccessful rep whose record retains the first call and its trajectory turns rather than erasing that evidence.
- [ ] #4 A replay confirmation test containing only completed STOP and Judge-validation-rejection reps observes durable Judge evidence, retention refs for every cited result SHA, strict rep records, removed rep worktrees, and removal of their common temporary root.
- [ ] #5 Existing replay and pipeline confirmation integration tests observe unchanged strict rep, group, and report shapes; completed outcomes clean up, pre-evidence failures preserve and log only created diagnostic worktrees, peers finish, and the temporary root remains only when it contains a preserved worktree.
- [ ] #6 bun test, bun run typecheck, bun run lint, and bun run fmt:check all exit successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: make stage-replay and full-pipeline confirmation share their stable evidence policies so fixes cannot drift while their mode-specific execution remains direct.

Resolved decisions:
1. Frozen input evidence has one shared representation and implementation. It writes text inputs, recursively enumerates directory inputs in deterministic path order, hashes exact bytes, and records paths relative to the confirmation group. The strict group-record schema remains the persisted contract.
2. Metric completeness follows ACT-5 acceptance criterion 7 and its implementation plan: every required provider attempt must have metrics; a missing attempt makes the rep ineligible for success but never becomes zero-valued evidence. Available calls remain role-attributed, and available worker turns still contribute to trajectory length. Pipeline accumulation therefore retains earlier calls when a later stage lacks metrics.
3. Completed evidence follows ACT-5 acceptance criterion 9 and commits f53a16a, 63628a5, and 016c1ad: STOP and exhausted Judge validation are completed outcomes, so their Judge evidence and cited result SHA are durable and their worktrees are removed. Failures without durable result evidence preserve and log a worktree only when one was created.
4. The shared completed-outcome order is Judge evidence file, retention ref, strict rep record, then worktree cleanup. Cleanup cannot precede durable evidence, and a completed record cannot cite an unretained result SHA. A lifecycle result explicitly reports whether a diagnostic worktree remains; group-root cleanup depends only on those results, including failures before worktree creation.
5. One shared group finalizer parses strict rep records, derives reliability and resources, writes report.json and group.json, and removes the temporary root exactly when no lifecycle result preserves a worktree. Replay continues to report its single declared stage with no applicable final outcome; pipeline continues to report every declared stage and the final outcome.
6. Replay keeps checkpoint resolution, staleness, materialization, single-stage execution, and replay-specific record construction direct. Pipeline keeps setup, baseline checks, task/checkpoint creation, sequential stage/checkpoint flow, final judging, clocks, and pipeline-specific outcome construction direct.

Interfaces likely to move:
- A shared confirmation-evidence module owns frozen-file persistence/enumeration, role-aware required-attempt metric classification, completed/diagnostic rep settlement, and group finalization.
- Each orchestrator supplies its mode-specific frozen inputs, record/outcome values, Judge evidence payload, retention effect, reporting projection, and log wording to those policies.

Deliberately unchanged: CLI behavior, cost approval, concurrency, artifact paths and schemas, reliability formulas, resource distributions, stage/final status semantics, and user-visible records/reports beyond correcting the two existing drifts described above.

Glossary terms added: none; Confirmation run, Rep, Rep outcome, Run artifact, and Trajectory step already cover the task.

First test to write: run a replay confirmation whose reps all finish with durable evidence (one STOP and one Judge validation rejection), predict that the current code leaves their empty temporary root because the rejected rep is EXECUTION_FAILED, and observe the new test fail on that root before extracting the lifecycle policy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped from ACT-5, GLOSSARY.md, docs/design.md, replay-confirmation.ts, pipeline-confirmation.ts, their integration tests, and the ACT-5 review-fix history.

Unknowns resolved from repository evidence:
- Cleanup classification is based on diagnostic need, not stage status. ACT-5 explicitly says completed Judge rejections clean up and pre-evidence failures preserve; pipeline already returns preservedWorktree while replay incorrectly keys root cleanup to JUDGED.
- Metric incompleteness does not erase available evidence. ACT-5 explicitly rejects zero substitution, and pipeline currently loses earlier worker metrics when a later stage returns no metrics; Judge-attempt collection already demonstrates the intended retain-and-mark-missing behavior.
- Frozen-file hashing is byte-based and deterministic in both current copies, so extraction preserves that established behavior rather than introducing a new file model.
- The shared boundary ends at stable evidence policy. Replay checkpoint flow and pipeline stage flow vary for domain reasons and remain visible in their orchestrators.

No decision was deferred.
<!-- SECTION:NOTES:END -->
