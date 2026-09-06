---
id: doc-25
title: 'reflection: ACT-76'
type: other
created_date: '2026-09-06 13:39'
---

# Reflection: ACT-76

## 1. What is the target condition?

Milestone m-1: prove the loop once, meaning a run/replay/compare cycle whose
comparison output can be trusted. This card's bet, per doc-16/doc-22/doc-23's
queue line, was that ACT-76 (with ACT-73 and ACT-74) blocks trusting the
comparison m-1 exists to produce, independent of the other two.

Concretely: a stage replayed against an edited corpus should show the grade
difference in the tool's own output, in the same command, without a human
reading two JSON records by hand.

## 2. What is the actual condition now?

Matches the bet. Verified directly against current code this run, not just
read from the card: `executionDifferences` still refuses on a model or effort
change; `corpusLineageDifferences` now feeds `presentAttempts`, which prints
the differing files and both attempts' grades in one command, with each
difference attributed to the attempt that carries it. Full suite passes fresh
(1060/1060). Git tree is clean, nothing uncommitted.

One thing the card itself flagged as unbuilt: no CLI-level end-to-end test
drives `runReplayCommand` through a real replay to observe this at that
boundary. The build session's reason (the pass-through has no branching logic
of its own, already covered by unit and integration tests one layer down) is
sound and I found nothing in the code to contradict it.

## 3. What obstacles stand between here and the goal, and which one is next?

This card is closed and adds no new obstacle. The review during build found
and fixed two defects beyond the shaped plan (an unattributed collapse of
three-or-more-attempt corpus differences, and duplicated traversal logic),
both verified, so nothing carries forward from this card specifically.

The obstacle still standing between here and "prove the loop once" is the
other two cards doc-23 named alongside this one: ACT-73 and ACT-74. ACT-73 is
also Done. ACT-74 (build stage's corpus files not recorded) is still To Do,
and it blocks the same trust question this card fixed for the shape stage:
today only an edit to CLAUDE.md is detected as making a checkpoint stale,
because the build stage doesn't record which files it read. A build-stage
replay comparison would silently miss a real corpus edit the way this card's
defect silently blocked a real one.

## 4. What is the next step, and what do you expect from it?

ACT-74, already on the board, To Do, m-1, no priority set. Building it should
make a build-stage checkpoint report stale on an edit to a skill file the
build stage read (e.g. `skills/build/SKILL.md`), the same way a shape-stage
checkpoint already does for CLAUDE.md. That closes the last named gap in "the
comparison m-1 exists to produce" can be trusted.

## 5. When can João go and see?

Now, for this card: running `replay` on the shape stage against a corpus with
an edited CLAUDE.md prints the comparison inline, naming the file and the
attempt, no second command. Verified this run using the same probe that
originally reproduced the defect.

Not yet for the build stage: that's what ACT-74 would make observable.

## Verdict

**On track.** The bet held, verified independently of the build session's own
claim. The next step (ACT-74) continues the same goal and was already queued;
this reflection surfaces no new obstacle.

## Proposals

None. ACT-74 is already on the board in the right place (To Do, m-1) with
acceptance criteria that match what this reflection would have asked for.

## Kaizen / structural notes

None. The one gap the build session left open (no CLI-level end-to-end test)
was a reasoned scope cut, not a defect, and the review that ran inside build
already caught and fixed the two real defects this card produced.
