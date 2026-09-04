---
id: ACT-48
title: settle the vocabulary the design introduces against the glossary
status: To Do
assignee: []
created_date: '2026-09-04 13:00'
updated_date: '2026-09-04 13:10'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, after ACT-47 landed the export: the spec is now readable, and it states the vocabulary as four settled nouns rather than two. docs/design-handoff/SPEC.md, "Domain model":

- Step: one agent session with instruction files in and artifacts out, followed by an independent judge. The unit graded and replayed.
- Task: a chain of steps against a base repository, judged AS A WHOLE from the first input and the last artifact only. The task judge does not read the intermediate steps.
- Case: a task PLUS the corpus, judges, and thresholds it runs under. What you actually run.
- Run: one execution of a case.

That sharpens this card's problem rather than settling it. Three things the card could not have known:

1. The design's Task carries a rule the codebase's Pipeline does not: judged from first input and last artifact only. The spec draws a consequence from it, that the same work as four steps and as one step produce comparable task grades, and it says a task grade must never be computed by averaging step grades. So this is not a rename of Pipeline; it is a different concept that needs its own glossary entry whichever naming wins.
2. The design's Case pins corpus, judges, and thresholds. The codebase's case declaration pins task, briefs, rubrics, pipeline, and target. Those overlap without matching.
3. The codebase's Attempt and Rep have no word in the design at all, and the design's Step/Task/Case/Run has no room for them. A decision that only maps Step->Stage and Task->Pipeline leaves those two unplaced.

The card's own recommendation (keep run and stage in code and records, treat the design's words as presentation labels mapped at the boundary) still looks right to me, and the 'task' collision with backlog cards is the strongest argument for it. But it now has to also say where Attempt and Rep sit, and it has to add glossary entries for the task-judging rule, task graph, and contribution as new concepts rather than new names.
<!-- SECTION:NOTES:END -->
