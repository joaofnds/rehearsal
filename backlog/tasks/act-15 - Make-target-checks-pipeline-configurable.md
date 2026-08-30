---
id: ACT-15
title: Make target checks pipeline-configurable
status: To Do
assignee: []
created_date: '2026-08-30 23:00'
labels: []
dependencies: []
ordinal: 7008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The harness still hard-codes target-repository specifics that vary per user, contradicting the principle that every rehearsal user brings their own workflow AND their own target:

- src/benchmark/checks.ts runChecks() hard-codes the check commands (bun run typecheck, bun run check, CONFIG_PATH=src/config/test.yaml bun run test:unit).
- src/benchmark/config.ts CHECK_PATHS hard-codes the integrity-hashed files (package.json, tsconfig.json, biome.json) and TEST_CONFIG_PATH.

Move these into configuration (natural home: the pipeline definition or a target section beside it), so a run against any repository declares its own baseline/treatment checks and its own check-integrity files. rubric.md's local-checks/check-integrity contract and README's Final Grading section must follow. The board columns and stage skills were made configurable in rehearsal commit 135f349; this finishes the job for the target side.
<!-- SECTION:DESCRIPTION:END -->
