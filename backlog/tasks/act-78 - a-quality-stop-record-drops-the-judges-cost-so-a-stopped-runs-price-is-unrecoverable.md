---
id: ACT-78
title: >-
  a quality-stop record drops the judge's cost, so a stopped run's price is
  unrecoverable
status: Done
assignee: []
created_date: '2026-09-05 03:44'
updated_date: '2026-09-05 03:44'
labels: []
dependencies: []
type: bug
ordinal: 74008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
writeStageJudgeFailure spreads a completed scorecard's grade findings into the record but drops the scorecard's costUsd. A run that stops on a quality gate therefore records the workflow session's cost and nothing for the judge, even though the judge ran to completion and its full verdict is in that same record.

Found 2026-09-05 running the audit-log case. The shape stage graded C against a B minimum, so the run stopped and wrote .benchmark-runs/2026-09-05T03-37-12.451Z.shape.json. That record holds the judge's hard blockers, requirements, dimensions and summary, and the only costUsd in it is the workflow session's 0.8253389999999999. The judge's spend is nowhere.

This is the gap ACT-43 originally described. ACT-43 turned out to be about the workflow cost missing from run totals, which is a different defect and is fixed. This one is real in exactly this record type.

Fixed by carrying the scorecard's costUsd into the record. Verified by writing a record with the real run's own input and a judge cost of 0.75, then reading both costs back and summing them to 1.575339. The existing test that pinned the record's exact contents now requires the cost. Full checks pass: 1015 tests, typecheck, oxlint, oxfmt.

Not covered here: whether the cost of a judge that failed before returning a scorecard is recorded. The pending.failure path already carries costUsd for that case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A STAGE_JUDGE_FAILED record written from a completed scorecard carries that scorecard's judge cost
<!-- AC:END -->
