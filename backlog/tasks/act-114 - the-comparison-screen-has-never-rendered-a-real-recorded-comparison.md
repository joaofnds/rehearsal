---
id: ACT-114
title: the comparison screen has never rendered a real recorded comparison
status: To Do
assignee: []
created_date: '2026-09-08 01:46'
updated_date: '2026-09-09 13:00'
labels: []
dependencies: []
priority: medium
type: chore
ordinal: 110008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The comparison screen is opened in a browser against a comparison recorded on disk, not a fixture, and the arm bands, case rows, contrast columns and attribution card are confirmed to render from it (source: ACT-50's reflection, doc-37; verified 2026-09-08 that .benchmark-runs/comparisons is empty, so every check on that screen so far used fixtures or the not-found path)
- [ ] #2 Why no comparison record exists on this checkout is settled and written down, given ACT-39 is Done and records one (source: doc-37 names this as worth chasing before it is carried forward silently)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action investigation. Priority Medium, unchanged.

The card's premise is confirmed by direct inspection this run, which prior runs had only inferred: .benchmark-runs/comparisons/ exists and is empty. So no comparison record exists on this checkout, and the screen has never had one to render. That is AC#2's question and it now has evidence behind it rather than an assumption.

Consequence for ACT-50: its AC#14 asks for the What moved tab observed in a browser against a recorded comparison, and no such record exists, so AC#14 cannot be checked until this card produces one. Recorded on ACT-50 as well. No dependency added, because ACT-50's other criterion can be built without a record and only its observation waits.
<!-- SECTION:NOTES:END -->
