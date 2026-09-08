---
id: ACT-120
title: 'a card shaped but left in its old column is re-shaped every step, at full cost'
status: To Do
assignee: []
created_date: '2026-09-08 13:34'
updated_date: '2026-09-08 15:19'
labels: []
dependencies: []
type: bug
ordinal: 116008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A card whose shaping session finished leaves that session with its status already moved to the next column, observed on a card taken through shaping end to end
- [ ] #2 An iterate step that would re-run a stage against a card already carrying that stage's finished record stops instead of re-running it, observed by stepping such a card twice
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed on ACT-51, 2026-09-08, in one iterate run.

What happened: shaping ran three times on the same card. The first pass ended on five questions, the second on two more, the third reported the card was already fully shaped across two adversarial review rounds and asked whether it should proceed to build instead. Each pass re-read the card and re-derived its plan before reaching that conclusion. Costs on stderr: 0.60, 0.61, 0.90, then 0.04 for the pass that recognized the card was done. Roughly 1.5 USD bought nothing.

Cause: no session moved ACT-51 out of To Do. iterate step routes a card by its column, so a card whose shaping is finished but whose status still reads To Do is sent back to shaping every step. The stage cannot break the loop from inside, because it is asked to shape and the card is shapeable; only the status says otherwise, and nothing was updating it. The board rules already require setting the status in the same turn as the work ('The status is a claim'), so the defect is that nothing enforced it. I moved the card to Build by hand in commit 025edd8 to break the loop.

Two candidate guards, either or both:
- The shaping stage moves the card to Build as part of finishing, so the claim and the work land together.
- iterate step refuses to re-run a stage against a card that already carries that stage's finished record, and reports the mismatch instead. This one also catches the case where a stage finishes without moving the card for some other reason.

Second, separate defect seen in the same run, worth a card of its own if it recurs: an --append-notes issued against a stale read reverted the card's notes to their pre-edit state and carried its own addition on top, silently dropping a block of answers (81a8310, restored in 2b628f2). The shaping session reported hitting the same thing with --notes and catching it via a reviewer. Both are the same underlying hazard: concurrent writers to one card file, where the CLI's read-modify-write has no staleness check.

Second instance, 2026-09-08, same iteration, different stage.

ACT-51 reached Review, review found a blocking defect and said so, and the card then needed code. But its column still read Review, so the next step invoked review again, which correctly reported there was nothing new to review and asked to pick up the fix instead. The step burned a session to discover the card was in the wrong column, exactly as the three shaping passes did.

This widens the card: the defect is not 'shaping does not move its card'. It is that the column is the only routing input, and a stage that finishes with work still owed has no way to say what the next stage should be. Review finding a blocker means the card goes back to Build; shaping finishing means it goes to Build; neither happens on its own.

The second guard proposed above (a step refuses to re-run a stage whose finished record is already on the card) would have caught the shaping loop but not this one, since the review record was new each time. What catches both: a stage that ends with work owed says which column the card belongs in, and the step honors that rather than re-reading the old column.
Second observation, 2026-09-08, on ACT-104. Same failure, unchanged: four
shape sessions ran on one card. The fourth recognised the card as build-ready
and refused as redundant, and the column only moved because a human moved it
by hand. Costs on stderr for the run: 0.30, 0.29, 0.46, 0.19, 1.13, then 0.04
for the pass that recognised it.

ACT-125 was filed for this before the duplicate was found and has been
removed. Its one addition is kept here: the board rule this violates is
~/.agents/rulebook/backlog-board.md, "The status is a claim", which already
requires the move in the same turn as the work. The gap is that nothing
enforces it, which is why acceptance criterion 1 asks for the observation
rather than the rule.

<!-- SECTION:NOTES:END -->
