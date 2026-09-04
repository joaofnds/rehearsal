---
id: ACT-41
title: >-
  the harness installs its own CLAUDE.md into the target as the target's project
  instructions
status: To Do
assignee: []
created_date: '2026-09-04 02:13'
labels: []
milestone: m-1
dependencies: []
priority: high
ordinal: 43008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/benchmark/config.ts defines PROJECT_INSTRUCTIONS_PATH as the control repository's own CLAUDE.md, and src/benchmark/backlog.ts installInstructions writes it into the target repository and commits it. For any case whose target is a different project, the agent is handed instructions describing the wrong codebase.

Observed 2026-09-04 in the first real pipeline run (ACT-38, record .benchmark-runs/2026-09-04T02-09-23.870Z.shape.json). The shape agent, working in the NestJS/MikroORM/BullMQ/Postgres template, received rehearsal's CLAUDE.md, which says 'TypeScript on Bun. No framework, no database, no server.' It reported the contradiction in its completion message, shaped the task from the real code instead, and asked whether to open a card to fix the file. The judge then counted that question against it as an open question at completion.

So the agent behaved correctly and lost grade for the harness's defect.

The config comment calls the file 'the project instructions under evaluation... corpus, not case'. That is coherent when the target IS the control repository, and wrong when a case declares its own target. A pipeline case names its target; its project instructions are a property of that target, not of the harness.

This invalidates any pipeline-case score against a target that is not this repository, which is every pipeline case the tool is meant to serve.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pipeline case whose target is a different repository runs with project instructions that describe that repository, not the control repository
- [ ] #2 A run against a target that declares no project instructions is refused or proceeds without installing any, and which one is chosen is recorded on this card with its reason
- [ ] #3 The corpus-under-evaluation meaning of the control CLAUDE.md is preserved for cases whose target IS the control repository, or the change records why that case no longer needs it
- [ ] #4 The audit-log case is re-run and its shape agent reports no contradiction between the instructions and the codebase
<!-- AC:END -->
