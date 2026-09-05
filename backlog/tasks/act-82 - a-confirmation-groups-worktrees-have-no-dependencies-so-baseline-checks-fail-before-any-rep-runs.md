---
id: ACT-82
title: >-
  a confirmation group's worktrees have no dependencies, so baseline checks fail
  before any rep runs
status: Done
assignee: []
created_date: '2026-09-05 16:06'
updated_date: '2026-09-05 16:39'
labels: []
dependencies: []
type: bug
ordinal: 78008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A confirmation group creates a git worktree per rep plus one for setup, then runs the pipeline's target checks in the setup worktree (pipeline-confirmation.ts:189). A fresh worktree carries only tracked files, so it has no node_modules, and any check needing installed dependencies fails before a single rep starts.

Observed 2026-09-05 running 'rehearsal run --case audit-log --confirm --reps 2'. Output: 'Baseline checks / Command failed (1): bun run typecheck'. The group stopped there.

Reproduced directly. A worktree of the audit-log target at its base commit has no node_modules, and 'bun run typecheck' in it fails with TS2688 'Cannot find type definition file for bun-types'. The same command in the target root passes, which is why single runs work: they use the target root, not a worktree.

Nothing in the harness installs dependencies. Grepping the whole source for 'node_modules' and for an install step returns nothing, so the confirmation-group path has never worked against a target whose checks need dependencies.

Not fixed here because the design is a real choice and it is not mine to make. Options: run the target's install command in each worktree before its checks, which is correct but slow and needs the command declared per case; or link or copy node_modules from the target root, which is fast but shares mutable state across reps that are supposed to be independent.

This blocks ACT-43's last acceptance criterion, which needs a real confirmation group report.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A confirmation group runs its baseline checks successfully against a target whose checks need installed dependencies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified 2026-09-05: the confirmation group now runs end to end. Group cdadb7d4 completed 2 reps against the audit-log case, whose pipeline declares 'bun install --frozen-lockfile' as setup. Baseline checks passed in the setup worktree and both rep worktrees.
<!-- SECTION:NOTES:END -->
