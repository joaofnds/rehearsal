---
id: ACT-98
title: record a per-step contribution phrase toward the task's final grade
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
ordinal: 94008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's task graph node and Contribution run-detail layout show a short phrase per step describing what it contributed toward the final artifact ('brief the later steps read', 'named 2 files to touch', 'contribution pending', 'not started'). Nothing in StageJudgeInput, StageScorecard, or StageJudgeRecord (contracts.ts) records any such phrase; it does not exist in any form today. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each recorded step carries a short phrase describing its contribution toward the task's final artifact, or a stated reason none exists (queued, not started)
<!-- AC:END -->
