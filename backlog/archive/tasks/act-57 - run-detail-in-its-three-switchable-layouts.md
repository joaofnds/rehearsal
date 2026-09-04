---
id: ACT-57
title: 'run detail, in its three switchable layouts'
status: To Do
assignee: []
created_date: '2026-09-04 13:07'
updated_date: '2026-09-04 13:07'
labels: []
dependencies:
  - ACT-50
priority: medium
ordinal: 59008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SPEC.md section 4. Step rail, record ledger, and contribution. All three ship switchable, because Joao said this is where he has least idea what good looks like, and the design left the choice to use. Step rail is the daily driver; contribution answers why a run ended as it did.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All three layouts render the same run and are switchable, with the switcher exposing pressed state
- [ ] #2 Step rail shows the attempts at a checkpoint with each attempt's corpus hash and whether it is current or stale
- [ ] #3 Record ledger shows every step's blockers and dimensions, and names the step that never ran as a recorded outcome rather than a failure
- [ ] #4 Contribution shows the task grade as not-gradable with its reason when a run stopped early, never as a zero
- [ ] #5 Cited evidence expands in place, tracks aria-expanded, and rows with no evidence are disabled and say so
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
