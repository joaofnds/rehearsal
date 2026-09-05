---
id: doc-14
title: 'reflection: ACT-44'
type: other
created_date: '2026-09-05 17:00'
---

# Reflection: ACT-44

## 1. What is the target condition?

Milestone m-1, "prove the loop once" (doc-7). The tool has never answered its
own question: no edit has been made, replayed, and compared. ACT-41 gates that
chain and is Done; ACT-39 is next and has never run. ACT-44 was not on that
critical path. Its bet, per doc-12's triage, was one of three independent m-1
cards (ACT-42, ACT-43, ACT-44) queued alongside the ACT-41→ACT-39 gate: make
`list runs` and `show` read what a stopped run actually wrote to disk, instead
of throwing a raw ENOENT at the operator.

## 2. What is the actual condition now?

Matches the bet exactly, verified live just now. `list runs` prints a clean
line for every one of the 13 runs that were broken when doc-12 last checked
this card (8 STOPPED:<stage>, 5 no-record), and one further run added since
then also reads clean. No raw filesystem error reaches the operator. The
card's own shape work found the original premise wrong (a stopped run never
writes the file `list` was looking for at all) and rescoped before building;
the build then matched the rescoped acceptance criteria and the direct check
today confirms it holds on the current disk state, not just at build time.

## 3. What obstacles stand between here and the goal, and which one is next?

None from this card. The one real obstacle on m-1 is unchanged from doc-7 and
doc-12: ACT-39 has never run, and nothing in ACT-44 unblocks or blocks that.
ACT-40 carries the same defect class (raw error from a lister) one call site
over, on `list attempts`, and is deliberately parked on m-5 to land with the
UI's shared read path per doc-12; that split was a deliberate choice, not
something this run should undo.

## 4. What is the next step, and what do you expect from it?

Continue doc-12's queue: ACT-42 and ACT-43 are the other two independent m-1
cards still open, and ACT-39 is the gated one that actually proves the loop.
None of the three needs a new card. Once ACT-39 runs, expect the first real
edit-replay-compare cycle the tool has ever completed, which is what m-1 is
actually waiting on.

## 5. When can João go and see?

Now: `./rehearsal.ts list runs` on this checkout shows every stopped and
recordless run with a plain line, no stack trace. Nothing further needed to
check this card.

## Verdict: on track

The bet held, the fix generalized past the two runs the card originally named
to all 13 that existed by triage time plus the one added since, and the goal
(m-1) is unaffected either way since this card was never on ACT-39's path.

## Proposals

None. No card to add, close, split, or reorder. ACT-40 stays on m-5 as doc-12
already decided.

## Kaizen candidate

None.
