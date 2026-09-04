---
id: ACT-51
title: 'let a run in flight be watched, which nothing on disk allows today'
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-04 14:47'
labels: []
milestone: m-6
dependencies:
  - ACT-49
  - ACT-52
  - ACT-53
priority: medium
ordinal: 53008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The live monitor is the screen Joao named as deserving the most design effort, and it is the one with no data behind it.

Today a run writes its record when a stage finishes. Progress goes to stdout as prose (14 console.log sites, ACT-26.7), nothing is written while a stage is in flight, and no process other than the one running the benchmark can see its state. So there is nothing for a monitor to read.

The design shows: which step is running, a spend bar against the ceiling, a wall clock, the agent session streaming, the judge panel, and a task graph whose nodes carry in/out counts for instruction files loaded and artifacts produced. Also an interrupted run that was reconciled, which needs partial state to survive a crash.

The lost UI solved this with durable run events and a startup reconciliation pass (migrations 0006-run-events and src/run-execution/startup-reconciliation.ts, both named in docs/recovered). That is evidence the shape is workable, not a design to copy: those files did not survive.

This is the largest card in m-4 and it is a harness change before it is a UI change. It should be shaped before it is built, and the shaping should decide whether run state becomes a file the harness appends to, a socket, or something else. ACT-26.7 lands underneath either way, since harness progress currently pollutes stdout.

Depends on the gap inventory, which is what establishes the real scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run in progress is observable by a second process while it runs, and what that process reads is written down
- [ ] #2 The monitor shows the running step, spend against the ceiling, and elapsed time, observed against a real run rather than a fixture
- [ ] #3 A run killed partway leaves state a later reader can reconcile into an interrupted outcome, observed by killing one
- [ ] #4 Harness progress no longer goes to stdout as prose, satisfying ACT-26.7 or superseding it explicitly
- [ ] #5 Introduces no raw visual value and no component the design system does not already own; anything new is added to the system, per decision-2
<!-- AC:END -->
