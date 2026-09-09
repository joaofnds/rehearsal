---
id: ACT-103
title: >-
  record reply word count on every pipeline attempt, not only session-case
  word-band checks
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 13:01'
labels: []
dependencies:
  - ACT-49
priority: low
ordinal: 99008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The comparisons screen's arm cards show avg word count beside cost deliberately, per the design spec: 'word counts sit beside cost deliberately - that is how verbosity gets caught'. countWords is invoked today only inside session-check-word-band.ts, which runs solely for session cases that declare a word-band check, and its result surfaces as a pass/fail message string, not a stored numeric field. A pipeline case's stage or task reply carries no recorded word count in any form. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every attempt (pipeline stage, task, or session) that produces a reply carries a numeric word count as a field on its record, independent of whether a word-band check is declared
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set Low this run, from unprioritized.

Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.
<!-- SECTION:NOTES:END -->
