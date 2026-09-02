---
id: ACT-24
title: record pipeline confirmation setup failure boundary
status: Build
assignee: []
created_date: '2026-09-01 13:52'
updated_date: '2026-09-02 12:04'
labels: []
dependencies: []
references:
  - src/benchmark/pipeline-confirmation.ts
  - src/benchmark/pipeline-confirmation.test.ts
  - src/benchmark/replay-confirmation.ts
type: enhancement
ordinal: 18008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make every pipeline confirmation rep failure before stage execution name the setup operation that rejected, so a recurrence of the worktree/setup flake can be diagnosed from the persisted rep record without changing stage or Judge attribution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When worktree creation rejects for one rep, that rep's first-stage `EXECUTION_FAILED` error is `worktree creation failed: <original cause>`, peer reps still reach stage execution, and no diagnostic-worktree preservation log is emitted for the uncreated worktree.
- [ ] #2 When initial checkpoint materialization rejects after worktree creation, the first-stage error is `checkpoint materialization failed: <original cause>`, the created worktree remains registered, and the existing pipeline evidence-preserved log names its path.
- [ ] #3 When corpus installation rejects before either the first or a later stage, the current stage error is `corpus installation failed: <original cause>`; any earlier judged stage and its evidence remain recorded, later stages and the final outcome are `NOT_REACHED`, and the created worktree is preserved and logged.
- [ ] #4 Workflow-stage, stage-Judge, and final-Judge failures keep their existing unqualified error text, role-attributed provider-call evidence, retention behavior, and diagnostic-versus-completed worktree lifecycle.
- [ ] #5 Confirmation rep and group records remain strict schema version 1 with no field-shape change, and the focused pipeline-confirmation test plus `bun test`, `bun run typecheck`, `bun run lint`, and `bun run fmt:check` exit successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Keep operation context local to `runPipelineRep`: set a stable label immediately before worktree creation, checkpoint materialization, and each corpus installation, then clear it immediately before `executeStageSession`. Prepend the active label only when constructing the diagnostic stage error, reuse the existing schema-version-1 `error` field, and leave `worktreeCreated` as the sole authority for retention and logging. Add corpus installation to `PipelineConfirmationDependencies` so the behavior can be injected at the owning boundary; wire the production function and test harness directly. Do not share mutable attribution state with replay because the two orchestration state machines differ and a formatting helper would not remove meaningful complexity.

First test: inject a rep-1 `addWorktree` rejection with a distinctive cause, let a peer complete, and assert the failed record says `worktree creation failed: synthetic worktree collision`, the peer reaches stage execution, and no preservation log exists for rep 1.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-02 from ACT-13.1, `runPipelineRep`, replay confirmation's implemented setup labels, the strict confirmation schemas, shared confirmation evidence settlement, the pipeline test harness, the glossary, and the relevant history.

Unknowns resolved:
- Scope: this task covers rep-level preparation owned by `runPipelineRep`, not confirmation-wide input freezing. `freezePipelineInputs` runs before rep records exist and changing its failure contract would require separate durable group-failure behavior.
- Boundaries: the asynchronous target-preparation boundaries before a stage session are worktree creation, initial checkpoint materialization, and corpus installation before each declared stage. Product Owner creation is a synchronous in-memory factory, not a separate target setup operation. Inter-stage checkpoint recording and final candidate capture happen after stage execution and keep their current attribution.
- Persistence: failed stages already carry a strict non-empty `error` string. Prefixing that string preserves schema version 1 and all readers.
- Lifecycle: the existing `worktreeCreated` boolean already distinguishes pre-worktree and post-worktree failures and controls preservation/logging. No persisted state or filesystem inference is needed.
- Failure categories: clear the setup label before every `executeStageSession` call and never reactivate it for stage execution, stage Judge, checkpoint recording, or final Judge work. Their existing typed evidence and settlement paths remain authoritative.
- Testability: corpus installation is currently a direct import, so add it to the pipeline dependency interface rather than manufacturing a filesystem failure. This is an owned orchestration seam and does not change production behavior.
- Sharing: keep setup context local to pipeline orchestration. Replay is a single-stage linear sequence; pipeline repeats setup while carrying accumulated stage, Product Owner, checkpoint, and Judge state. A shared stateful tracker would couple those axes, while a pure string formatter would add indirection without reducing knowledge duplication.

Glossary terms added: none. "Setup operation" is diagnostic wording for existing preparation, not a new domain concept.

No product decision was deferred.
<!-- SECTION:NOTES:END -->
