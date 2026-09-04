---
id: ACT-48
title: settle the vocabulary the design introduces against the glossary
status: To Do
assignee: []
created_date: '2026-09-04 13:00'
labels: []
milestone: m-4
dependencies: []
priority: high
ordinal: 50008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The prototype uses words the codebase does not, and one of them collides.

The design says **task** where the harness says **run**, and **step** where the harness says **stage**. GLOSSARY.md already defines run and stage, and the pipeline definition declares `stages`. Meanwhile "task" already means something else in this project: a backlog card. So adopting the design vocabulary wholesale would give "task" two meanings in one repository.

The design also introduces terms the glossary has no entry for: a **task graph** (steps as nodes, with in/out counts for instruction files loaded and artifacts produced), and per-run **contribution**, which appears as one of the three run-detail layouts.

This is not a naming preference. Every screen label, every route, and every API shape in the m-4 cards depends on the answer, and changing it later means touching all of them. The judge prompts and the recorded artifacts also use the current words, so a rename is not confined to the UI.

Recommendation, for Joao to accept or overturn: keep run and stage in the code, the records, and the glossary, and treat the design's task/step as presentation labels only, mapped at the boundary. That keeps 531 commits of records readable and avoids the collision with backlog tasks. The cost is that the UI and the CLI say different words for the same thing, which is a real cost and the reason this is a decision rather than an assumption.

Whatever is decided, GLOSSARY.md gains entries for task graph and contribution, since those are new concepts rather than new names for old ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded on the board naming which vocabulary the code uses and which the UI displays, with its reason
- [ ] #2 GLOSSARY.md carries an entry for every term the design introduces that survives the decision
- [ ] #3 If the words differ between UI and code, the mapping is written down in one place that the UI cards reference
<!-- AC:END -->
