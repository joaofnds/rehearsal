---
id: ACT-13.1
title: record replay confirmation setup failure boundary
status: Build
assignee:
  - claude
created_date: '2026-09-01 12:33'
labels: []
dependencies: []
parent_task_id: ACT-13
type: bug
ordinal: 17008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make every replay confirmation failure before the workflow callback name the setup operation that rejected, so a recurrence of the ACT-13 flake identifies the cause from its persisted rep record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When replay confirmation worktree creation rejects for one rep, that rep's persisted `EXECUTION_FAILED` stage error names worktree creation and retains the original error text, while the other reps still reach the workflow callback.
- [ ] #2 When a replay confirmation operation after worktree creation rejects, the persisted stage error names that exact operation, the existing evidence-preserved log is emitted, and the failed rep's worktree remains registered for diagnosis.
- [ ] #3 Setup-operation context covers every fallible step before `executeStageSession`: worktree creation, checkpoint materialization, instruction installation, corpus installation, delivery dependency installation, prior-artifact reading, baseline hash capture, and baseline-context capture.
- [ ] #4 Confirmation rep/group records keep schema version 1 and their existing shape; successful reps, workflow/Judge failures, reliability calculation, and worktree cleanup behavior remain unchanged.
- [ ] #5 The focused replay-confirmation suite and the full test, typecheck, lint, and format checks pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Keep setup context local to `runReplayConfirmation`: track a stable human-readable operation label immediately before each fallible pre-session step, clear it before calling `executeStageSession`, and prepend it only when the diagnostic catch still has an active setup label. Reuse the existing error field rather than extending the strict version-1 confirmation schema. Preserve the current `worktreeCreated` flag as the authority for retaining and logging a diagnostic worktree.

First test: in `replay-confirmation.test.ts`, inject a rep-1 `addWorktree` rejection with a distinctive message, let reps 2 and 3 complete, and assert that rep 1's parsed record says worktree creation failed while preserving the distinctive cause text.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed once on 2026-09-01 during the 31-file isolation sweep: `finished` was `[3]` instead of `[1, 3]`. A failure-only `ACT13_DEBUG` probe was then run for 230 isolated repetitions without recurrence and removed; no probe remains. The subsequent isolation sweep and full 354-test suite passed.

Debug follow-up 2026-09-01:
- The exact focused reproduction, `bun test src/benchmark/replay-confirmation.test.ts -t "cleans completed Judge outcomes"`, passed with 1 pass, 0 failures, and 6 expectations.
- Another 100 complete `src/benchmark/replay-confirmation.test.ts` runs passed, preserving the neighboring-test and three-rep concurrency context. Together with the earlier focused probe, 330 subsequent runs have not reproduced the symptom.
- The observed `[3]` outcome constrains the missing rep to failure before `runWorkflowStage`: rep 2 reached that callback and released the test latch, rep 3 then finished, and rep 1 did not. It does not distinguish `addWorktree` from checkpoint materialization, instruction installation, corpus installation, or baseline capture. No cause can therefore be switched on and off from current evidence.
- No production or test behavior changed, and no debug probe remains.

Next discriminating options if the failure recurs:
1. Before fixture cleanup, retain the failed rep record and inspect its `error` plus whether its recorded `worktreePath` exists and appears in `git worktree list --porcelain`. Absence selects `addWorktree`; presence selects later preparation.
2. Add one failure-only probe, prefixed `ACT13_DEBUG`, that tracks the last completed boundary among `addWorktree`, `materializeCheckpoint`, `installInstructions`, `installStageCorpusSnapshot`, `captureFileHashes`, and `captureBaselineContext`; remove it after capturing the rejection.
3. Once one boundary is named, inject that exact rejection at the dependency seam as the deterministic regression observation, then vary only the suspected contention or input to establish materially different failure rates before shaping a fix.

Shaped 2026-09-01 from the debug result, the confirmation record schema, replay confirmation's setup sequence and dependency seams, confirmation evidence settlement, the shared replay harness, the glossary, and project doctrine sections 1, 2, and 5.

Unknowns resolved:
- Scope: the root cause remains unreproduced after 330 subsequent runs, so this task does not guess at or fix it. It makes the existing diagnostic evidence identify the failing setup operation; a later debug starts from that evidence.
- Persistence: failed stages already carry a strict, non-empty `error` string. Adding context there avoids an unsupported schema-version change and keeps every current record reader compatible.
- Boundary: context belongs in `runReplayConfirmation`, which owns the ordered setup operations and the diagnostic catch. Lower-level Git, checkpoint, and backlog helpers should keep their reusable errors free of replay-specific wording.
- Preservation: the existing `worktreeCreated` state already distinguishes failures before and after worktree creation and controls diagnostic retention. No second persisted state or filesystem inference is needed.
- Coverage: include delivery-only dependency installation and prior-artifact reading even though the observed failure was a planning replay; they share the same pre-session catch and otherwise leave the same attribution gap.
- Failure categories: clear the setup label before entering `executeStageSession`. A workflow rejection can leave the session result unset too, so checking only for a missing session would incorrectly relabel a workflow failure; workflow and Judge failures already have their own evidence semantics.

Glossary terms added: none. "Setup operation" is diagnostic wording for the existing sequence before stage execution, not a new domain concept.

No product decision was deferred.
<!-- SECTION:NOTES:END -->
