---
id: ACT-144
title: build and freeze generated fixtures for session cases
status: To Do
assignee: []
created_date: '2026-09-09 15:49'
labels: []
dependencies: []
references:
  - src/benchmark/checks.ts
  - src/benchmark/session-lineage.ts
  - src/benchmark/case.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 140008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A copied fixture tree cannot conveniently express the triage benchmark's CLI-built board and git history. Add case-declared setup whose realized output becomes the recorded starting state. Repeatedly running identical commands is insufficient: timestamps, git identity, configuration and external inputs can change the tree or history.

Choose the declaration format and error contract during shaping. Reuse runSetup where it fits, without imposing pipeline targets on session cases. Either freeze the built state for reuse or prove equivalent realized states before comparison. Include setup inputs and the resulting tree/history identity in the evidence used for comparability. First verification target: a builder that creates committed history and board files, then changes its output across invocations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session case’s declared setup creates files and git history that the session observes in its isolated working directory (João’s approved session benchmark scope, doc-59)
- [ ] #2 Every arm sharing a fixture input receives the recorded equivalent starting tree and git history, even when independent builder invocations would produce different timestamps (João’s approved session benchmark scope, doc-59)
- [ ] #3 The run records the setup definition and realized starting-state identity so changed fixture inputs cannot be silently compared as identical (João’s approved session benchmark scope, doc-59)
- [ ] #4 A setup failure is recorded and reported before any model session starts (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->
