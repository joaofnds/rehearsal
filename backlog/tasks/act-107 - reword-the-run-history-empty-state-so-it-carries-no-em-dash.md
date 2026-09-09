---
id: ACT-107
title: reword the run-history empty state so it carries no em dash
status: To Do
assignee: []
created_date: '2026-09-07 21:39'
updated_date: '2026-09-09 13:01'
labels: []
dependencies: []
priority: low
type: chore
ordinal: 103008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The empty-state sentence rendered at / on a checkout with no records contains no em dash, verified by grepping the rendered client source for the character (corpus hard line: an em dash is never written, in anything)
- [ ] #2 SPEC.md section 1's empty-state prose carries the same reworded sentence, so the code and the design document agree (ACT-53 AC #3 requires the empty state to match SPEC.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority Low, unchanged.

Premise confirmed this run by direct grep: client/src/run-history/run-history-page.tsx line 114 carries 'run it - every attempt lands here as a durable record' with an em dash. The same file uses one at line 51 as a no-value placeholder and system-page.tsx carries three more, so whoever takes this should decide whether the card covers the empty state alone, as its title says, or every em dash the client renders. The placeholder at line 51 is a dash used as a symbol, not as punctuation, which is a different question from the prose ones.
<!-- SECTION:NOTES:END -->
