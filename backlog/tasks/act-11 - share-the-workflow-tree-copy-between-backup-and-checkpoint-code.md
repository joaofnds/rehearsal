---
id: ACT-11
title: share the workflow tree copy between backup and checkpoint code
status: Build
assignee:
  - '@claude'
created_date: '2026-08-30 20:16'
updated_date: '2026-09-02 14:53'
labels: []
dependencies: []
ordinal: 3008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make backup/restore and checkpoint/materialize use one workflow-state boundary so every operation applies the same backlog/ and .boris/ tree-copy semantics without changing behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun test src/benchmark/target.test.ts observes restoreTarget reproduce the captured workflow state byte-for-byte, preserve an originally empty directory, remove files added after capture, and remove a whole workflow tree that was absent at capture.
- [ ] #2 bun test src/benchmark/target.test.ts observes captureWorkflowBackup reject a non-ENOENT discovery failure rather than record partial state.
- [ ] #3 bun test src/benchmark/checkpoint.test.ts continues to observe byte-faithful checkpoint materialization, empty-directory preservation, omission of absent workflow paths, and rejection of non-ENOENT discovery failures.
- [ ] #4 Source inspection finds one workflow-state module declaring the workflow paths and tree copy/replace semantics; target.ts and checkpoint.ts consume that boundary without their own workflow-path discovery or copy loops.
- [ ] #5 bun test, bun run fmt:check, bun run lint, and bun run typecheck all exit successfully.
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
<!-- SECTION:NOTES:END -->
