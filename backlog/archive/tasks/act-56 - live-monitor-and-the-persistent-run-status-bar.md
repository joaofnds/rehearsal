---
id: ACT-56
title: live monitor and the persistent run status bar
status: To Do
assignee: []
created_date: '2026-09-04 13:07'
updated_date: '2026-09-04 13:07'
labels: []
dependencies:
  - ACT-49
priority: high
ordinal: 58008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The screen the design invests most in, and the one Joao has never had. SPEC.md section 2 and the persistent status bar section. Four bands: identity header, spend band, task graph, then session and judge panes side by side. The status bar is separate from the screen and visible from every screen whenever a run is in flight, because runs are started and left.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The spend band renders spent, ceiling, burn rate, elapsed, tokens, and the striped ceiling meter with its numeric label
- [ ] #2 The task graph renders the steps in order as connected node cards, with the running one distinguished by glyph and word, not by color alone
- [ ] #3 Selecting a node drives the session and judge panes below it
- [ ] #4 The status bar appears on every screen while a run is in flight and announces step transitions through an aria-live region, not every cost tick
- [ ] #5 The pulse animation is replaced by a static glyph under prefers-reduced-motion
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
