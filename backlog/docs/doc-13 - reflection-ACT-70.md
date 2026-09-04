---
id: doc-13
title: 'reflection: ACT-70'
type: other
created_date: '2026-09-04 23:43'
---

# Reflection: ACT-70, 2026-09-05

## 1. What is the target condition?

ACT-70 carries no milestone field of its own, but it was found while shaping
ACT-39, m-1's own head card, and its own notes name the reason: ACT-39's
second oversight probe showed a shape run can grade F for a cause the
STAGE_JUDGE_FAILED artifact does not record, so a repeat failure would again
be undiagnosable. The card's bet, stated in its own closing note: "ACT-39's
next run will be the first live confirmation" that a failed stage run's
artifact alone answers what the judge objected to.

## 2. What is the actual condition now?

The bet held, verified independently in this reflection, not only by the
build and oversight sessions that closed the card. I read the fix commit
directly: `writeStageJudgeFailure` now spreads a scorecard's
hardBlockers/requirements/dimensions/summary into the failed artifact when
one is attached, and `runGradedStages` attaches the scorecard to the pending
stage on a STOP verdict, through the same seam already used for the
malformed-output path. The diff is two lines in `run.ts` and one spread in
`run-abort.ts`, matching the card's own description of a single-field
addition through an existing seam. The targeted tests
(`run-abort.test.ts`, `run.test.ts`, 67 tests) pass on a fresh run I drove
myself.

What the card could not do, and says so itself: no live paid run has
exercised this path. The end-to-end test drives the same abort logic with
real file I/O but a fake judge; the actual confirmation is whatever ACT-39
produces the next time a shape stage fails.

## 3. What obstacles stand between here and the goal, and which one is next?

This closes the diagnosability gap that ACT-39's own oversight probe found
mid-shape. It does not unblock ACT-39 by itself: ACT-39's card already lists
its own order of work (fix the corpus defects it separately found, pay for
one clean shape run, confirm a checkpoint lands, then edit, check staleness,
replay, and read both records). ACT-70 only guarantees that if that paid
run fails again, the failure will be readable from the artifact instead of
silent.

No new obstacle surfaced. The one this card flagged as open, a live run
never having exercised the code path, is not a defect to fix; it is ACT-39
itself, already queued and already the mechanism that pays for that run.

## 4. What is the next step, and what do you expect from it?

ACT-39, already on the board, To Do, high priority, head of the ready queue,
both dependencies Done. Its next paid shape run is also the first live test
of this card's fix: if that run fails judgment, its artifact should now name
the failed rubric items and why, without a re-run.

## 5. When can João go and see?

Now, for this card: `git show fc2e5c4` shows the fix, and
`bun test src/benchmark/run-abort.test.ts src/benchmark/run.test.ts`
reproduces the 67 tests that pin it.

Not yet for the goal itself: no comparison exists yet, and this card's own
live confirmation is still pending ACT-39's next paid run.

## Verdict: on track

The bet held on every check available without spending the run. The next
step was already queued before this card closed and needs no change.

## Proposals

None. No card is overtaken, superseded, or newly needed. ACT-39 remains the
single next step and already carries the order of work.

## Kaizen

None. The gap this card fixed was caught by an oversight probe during
shaping, before any code was written on the wrong assumption, which is the
process working as intended.
