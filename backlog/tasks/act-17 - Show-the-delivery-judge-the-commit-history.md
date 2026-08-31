---
id: ACT-17
title: Show the delivery judge the commit history
status: To Do
assignee: []
created_date: '2026-08-31 02:05'
labels: []
dependencies: []
ordinal: 9008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The build-stage Judge grades delivery-discipline (incremental, test-first commit sequence) but its input carries only the flattened baseline..result diff. Run 2026-08-31T01-45-19 delivered five clean conventional commits and was graded C for lacking visible incremental history. Add the stage's commit subjects (git log baseline..result) to StageJudgeInput for stages that commit, citable as its own source, and name it in the stage judge prompt.
<!-- SECTION:DESCRIPTION:END -->
