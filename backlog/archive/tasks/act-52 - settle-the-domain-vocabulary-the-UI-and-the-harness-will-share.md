---
id: ACT-52
title: settle the domain vocabulary the UI and the harness will share
status: To Do
assignee: []
created_date: '2026-09-04 13:05'
updated_date: '2026-09-04 13:07'
labels: []
milestone: m-1
dependencies: []
priority: high
ordinal: 54008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design handoff renames the domain, and the codebase and the design now disagree in the words they use for the same things.

docs/design-handoff/SPEC.md states four nouns as settled: Step (one agent session plus its judge, the unit graded and replayed), Task (a chain of steps against a base repository, judged only from first input and last artifact), Case (a task plus the corpus, judges, and thresholds it runs under), Run (one execution of a case).

GLOSSARY.md and src/ say Stage, Pipeline, Case, Run, Attempt. The overlaps are not clean:
- the design`s Step is the codebase`s Stage
- the design`s Task is close to the codebase`s Pipeline, but the codebase`s Pipeline does not carry the "judged from first input and last artifact only" rule
- the design`s Case pins corpus, judges, and thresholds; the codebase`s Case declaration pins task, briefs, rubrics, pipeline, and target
- the codebase has Attempt, which the design has no word for
- the design has no word for the codebase`s Rep

The house rule is one ubiquitous language across conversation, code, tests, and the glossary. Two vocabularies for one domain is the defect this card exists to close, and it has to close before the UI is built, because every screen name, route, and record field will carry whichever set wins.

This is a decision, not a build. It needs Joao, because the design README asserts he settled this vocabulary explicitly during the design session, and the codebase predates that.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of Step, Task, Case, Run, Attempt, Rep, Stage, and Pipeline is recorded as either kept, renamed, or dropped, with the reason
- [ ] #2 GLOSSARY.md carries the settled set, and no term in it has two names
- [ ] #3 The decision is recorded on the board as a decision, so a later session does not reopen it
- [ ] #4 The renames the decision implies for src/ are listed on this card as their own follow-up task, not done here
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
