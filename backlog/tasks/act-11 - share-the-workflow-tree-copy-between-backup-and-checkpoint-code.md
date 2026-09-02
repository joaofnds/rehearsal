---
id: ACT-11
title: share the workflow tree copy between backup and checkpoint code
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 20:16'
updated_date: '2026-09-02 15:52'
labels: []
dependencies: []
modified_files:
  - src/benchmark/target.test.ts
  - src/benchmark/target.ts
  - src/benchmark/checkpoint.ts
  - src/benchmark/config.ts
  - src/benchmark/workflow-state.ts
ordinal: 3008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make backup/restore and checkpoint/materialize use one workflow-state boundary so every operation applies the same backlog/ and .boris/ tree-copy semantics without changing behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun test src/benchmark/target.test.ts observes restoreTarget reproduce the captured workflow state byte-for-byte, preserve an originally empty directory, remove files added after capture, and remove a whole workflow tree that was absent at capture.
- [x] #2 bun test src/benchmark/target.test.ts observes captureWorkflowBackup reject a non-ENOENT discovery failure rather than record partial state.
- [x] #3 bun test src/benchmark/checkpoint.test.ts continues to observe byte-faithful checkpoint materialization, empty-directory preservation, omission of absent workflow paths, and rejection of non-ENOENT discovery failures.
- [x] #4 Source inspection finds one workflow-state module declaring the workflow paths and tree copy/replace semantics; target.ts and checkpoint.ts consume that boundary without their own workflow-path discovery or copy loops.
- [x] #5 bun test, bun run fmt:check, bun run lint, and bun run typecheck all exit successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a restoreTarget characterization test covering changed and added files, an originally empty directory, and a workflow tree that did not exist at capture; add the backup discovery-error test.
2. Introduce src/benchmark/workflow-state.ts to own WORKFLOW_PATHS, ENOENT-only path discovery, whole-tree copy, and replace semantics. Move the fixed path declaration out of config.ts.
3. Rewire checkpoint recording/materialization and target backup/restore through that boundary. Let WorkflowBackup identify only its snapshot directory because the snapshot itself records which workflow trees were present.
4. Run the focused tests, then the full format, lint, type, and test gates; directly exercise one backup/mutate/restore round trip.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping (2026-09-02)

Goal: Make every workflow-state snapshot and restoration operation share one definition and one set of whole-tree copy semantics.

Resolved unknowns:
1. Ownership: a new workflow-state module owns the fixed workflow paths and filesystem operations. The paths are domain policy rather than configurable CLI input, and both target lifecycle and checkpoints are clients.
2. Restore behavior: replacement, not merge. Existing restoreWorkflowBackup removes every known workflow path before copying the captured trees, which prevents run-created state from surviving teardown.
3. Tree fidelity: copy whole trees so empty directories survive. Commit e0efe58 records the observed backlog failure caused by file-by-file materialization.
4. Failure behavior: only ENOENT means absent; permission and I/O errors propagate. Commit 8ea8f78 established this checkpoint contract, and the shared boundary must apply it to backups too.
5. Backup representation: presentPaths is derived from the backup tree and has no consumer outside target.ts, so WorkflowBackup can carry only its directory.

Glossary terms added: Workflow state.

First test: in restoreTarget, capture a repository whose backlog contains a file and an empty directory while .boris is absent; mutate and add backlog entries and create .boris; restore; then assert the original bytes and empty directory are present and every added entry and .boris are absent.

Build handoff (2026-09-02)

Changed: Added `src/benchmark/workflow-state.ts` as the sole owner of `backlog/` and `.boris/` discovery, whole-tree copy, and replacement. Target backup/restore and checkpoint record/materialization now consume that boundary. `WorkflowBackup` freezes captured tree membership so later backup-directory changes cannot alter restore semantics.

Wiring: All target and checkpoint callers use the shared boundary. No callers remain on the old path, and no newly possible behavior is left unwired.

Observed: `bun test src/benchmark/target.test.ts src/benchmark/checkpoint.test.ts` passed 62 tests. Final `bun test` passed 444 tests across 35 files; `bun run fmt:check`, `bun run lint`, and `bun run typecheck` exited successfully. A fresh clone/capture/mutate/restore run returned bytes `[0,255,10]`, preserved an empty directory, removed an added file, and removed an originally absent `.boris/` even when `.boris/` was planted in the backup after capture.

Not verified: Nothing within the acceptance criteria remains unverified.

Stopped work: Independent review found one blocking membership regression. It was reproduced by two failing focused tests and fixed in `d871ac5`; missing captured trees now reject and planted trees are ignored. The same investigation found and fixed directory-absence assertions that used `Bun.file(...).exists()`. No other review findings were reported.

Refactor pass: Removed the obsolete one-call restore wrapper in `6c853e4`; no further structural task was warranted.

Review: Independent review was due for filesystem replacement semantics and completed. Style, architecture beyond the fixed finding, security, and refactoring axes found nothing additional.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared workflow-state discovery, copy, and replacement behind one module and rewired target backups plus checkpoints to use it. Verified 444 tests and all format, lint, and type gates; directly observed exact-byte restoration, empty-directory preservation, added-state removal, and absent-tree removal. Independent review found one blocking captured-membership regression, fixed in `d871ac5` and covered by failing-then-passing tests.
<!-- SECTION:FINAL_SUMMARY:END -->
