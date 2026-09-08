---
id: ACT-125
title: 'a finished shape session leaves the card in To Do, looping the iteration'
status: To Do
assignee: []
created_date: '2026-09-08 21:43'
labels: []
dependencies: []
ordinal: 121008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Observed 2026-09-08 during the ACT-104 iteration. The shape sessions finished their work and wrote it to the card, but never moved the column off To Do. `iterate step` dispatches by column, so each following step dispatched `/shape` again on an already-shaped card. Four steps ran that way. The last one recognised the card as build-ready and refused as redundant, which is the only reason the loop was visible rather than silent.

The board rule is explicit (~/.agents/rulebook/backlog-board.md, 'The status is a claim'): set the status to the next step, or Done, in the same turn as the work. Shaping had finished, so the card belonged in Build. A human had to move it by hand for the iteration to advance.

Cost: four sessions' worth of tokens re-deriving a finished card, and a card that reports the wrong state to anyone reading the board.

The fix is a system guard rather than more vigilance, since the shape sessions each individually believed they were done. Candidates: `iterate step` refuses to dispatch the same column twice in a row on one card, or the shape skill's exit requires the move the same way the last step already refuses to return with an uncommitted tree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shape session that finishes shaping leaves the card in Build, shown by the column after the session returns
- [ ] #2 An iteration that would dispatch the same stage twice in a row on one card stops instead
<!-- AC:END -->
