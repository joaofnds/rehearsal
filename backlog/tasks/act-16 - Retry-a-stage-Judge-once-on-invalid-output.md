---
id: ACT-16
title: Retry a stage Judge once on invalid output
status: To Do
assignee: []
created_date: '2026-08-30 23:30'
labels: []
dependencies: []
ordinal: 8008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stage Judge that returns schema-valid output with an invalid evidence citation (or otherwise fails validation in validateStageJudgeEvidence/deriveStageGrade) currently kills the whole run as STAGE_JUDGE_FAILED, discarding a paid engineering session (observed 2026-08-31: shape stage succeeded, Judge cited task-state:task.status, run died). Add one retry of the Judge call against the same frozen input before declaring STAGE_JUDGE_FAILED, recording both attempts and their costs in the stage file. Same consideration for the final Judge in judge.ts.
<!-- SECTION:DESCRIPTION:END -->
