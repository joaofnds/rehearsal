---
id: ACT-79
title: 'a run cannot lower the stage quality gate, so a C stops every run at shape'
status: Done
assignee: []
created_date: '2026-09-05 03:58'
updated_date: '2026-09-05 03:58'
labels: []
dependencies: []
type: feature
ordinal: 75008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stage's grade is its worst dimension, and the gate was hardcoded to B. A run with every hard blocker and every requirement passing still stopped when one dimension of four graded C. That is what kept the audit-log case from ever reaching the build stage.

Observed 2026-09-05 in .benchmark-runs/2026-09-05T03-37-12.451Z.shape.json: five hard blockers PASS, five requirements PASS, dimensions B, B, B and one C on carry-forward. Stage graded C, run stopped.

Added --minimum-grade (BENCHMARK_MINIMUM_GRADE), defaulting to B. The gate now compares the letter against the caller's minimum instead of reading the Judge's verdict, which is derived against a fixed B. Judges grade and record exactly as before, so runs that gated differently stay comparable.

Verified by calling the gate with the C that stopped the real run: the default stops it naming B, a minimum of C continues, and a minimum of A stops it naming A. Full checks pass: 1018 tests, typecheck, oxlint, oxfmt.

Also collapsed the grade letters to one definition. They were declared in contracts and again as GRADE_ORDER in stage-grading; both now derive from STAGE_LETTER_GRADES in config, which is the leaf both already import.

Note for later: this lowers the bar rather than fixing what earns the low grade. The carry-forward C came from the card deferring acceptance detail to a plan document the Judge never received and from the brief's validation rules never reaching the card. Those are real and remain.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A run passes --minimum-grade to continue past a stage graded below B, with the Judge still grading and recording unchanged
- [x] #2 Omitting the flag keeps the B minimum
- [x] #3 An unrecognized grade letter is refused with a message naming the valid letters
<!-- AC:END -->
