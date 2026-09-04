---
id: ACT-70
title: 'a failed stage run records the judge''s findings, not just the grade'
status: To Do
assignee: []
created_date: '2026-09-04 23:32'
updated_date: '2026-09-04 23:32'
labels: []
dependencies: []
type: bug
ordinal: 66008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while shaping ACT-39 on 2026-09-05.

A STAGE_JUDGE_FAILED artifact holds exactly four keys: status, stage, error, and input. The error is one line, 'shape stage graded F; minimum grade is B'. The judge's findings, the per-rubric-item reasoning that produced that grade, are written nowhere.

The cost of this is concrete. Two runs of the audit-log case both graded F. For the first, the defects were reconstructable by reading the shaped card in input.taskState against the product brief: a 201/202 contradiction and two validation rules dropped. For the second run the shaped card is clean, 202 throughout with all three rules stated, and it still graded F. Why is unanswerable from the artifact. That run's 0.53 USD bought a grade and no diagnosis.

This matters more than a normal logging gap because the tool exists to tell an operator whether a corpus edit helped. An edit that moves a grade from F to F, for different reasons, is invisible today. So is an edit that fixes one finding and introduces another.

The input the judge saw is already persisted, so the asymmetry is only on the output side.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run whose stage fails judgment records the judge's findings text in the run artifact
- [ ] #2 The recorded findings name each rubric item the stage failed and why
- [ ] #3 Reading a failed run's artifact alone answers 'what did the judge object to' without re-running the stage
<!-- AC:END -->
