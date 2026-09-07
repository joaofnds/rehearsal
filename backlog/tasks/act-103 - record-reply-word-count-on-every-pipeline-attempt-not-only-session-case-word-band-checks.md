---
id: ACT-103
title: >-
  record reply word count on every pipeline attempt, not only session-case
  word-band checks
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
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
