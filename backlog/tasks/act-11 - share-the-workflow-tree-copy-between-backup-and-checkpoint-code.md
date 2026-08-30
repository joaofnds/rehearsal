---
id: ACT-11
title: share the workflow tree copy between backup and checkpoint code
status: To Do
assignee: []
created_date: '2026-08-30 20:16'
labels: []
dependencies: []
ordinal: 3008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
captureWorkflowBackup and restoreWorkflowBackup in src/benchmark/target.ts walk WORKFLOW_PATHS with their own stat-and-copy loops; src/benchmark/checkpoint.ts now has existingWorkflowPaths/copyWorkflowTrees doing the same walk. Backup/restore is checkpoint/materialize without hashes. Converge them so one module owns the knowledge of what workflow state is and how a tree is copied. Touches teardown correctness, so it needs its own tests around restoreTarget.
<!-- SECTION:DESCRIPTION:END -->
