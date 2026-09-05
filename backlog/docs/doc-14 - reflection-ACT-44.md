---
id: doc-14
title: 'reflection: ACT-44'
type: other
created_date: '2026-09-05 17:00'
updated_date: '2026-09-05 17:01'
---
# Reflection: ACT-44

## 1. What is the target condition?

Milestone m-1, "prove the loop once" (doc-7). ACT-41 gates the chain and is
Done, and ACT-39 closed today at 03:50 on the first real replay. ACT-44 was
not on that critical path. Its bet, per doc-12's triage, was one of three
independent m-1 cards (ACT-42, ACT-43, ACT-44) queued alongside the
ACT-41→ACT-39 gate: make `list runs` and `show` read what a stopped run
actually wrote to disk, instead of throwing a raw ENOENT at the operator.

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

None from this card. ACT-40 carries the same defect class (raw error from a
lister) one call site over, on `list attempts`, and is deliberately parked on
m-5 to land with the UI's shared read path per doc-12; that split was a
deliberate choice, not something this run should undo.

The session that wrote the first draft of this doc said ACT-39 had never run
and ACT-43 was still open. Both were already Done on the board (ACT-39 at
03:50, ACT-43 at 18:39, both 2026-09-05). The overseer corrected this doc
after the session returned.

## 4. What is the next step, and what do you expect from it?

Of doc-12's three independent m-1 cards, only ACT-42 is still open. With
ACT-39 Done, the next triage has to say whether m-1's target condition is
met or name the card that still stands between the board and it.

## 5. When can João go and see?

Now: `./rehearsal.ts list runs` on this checkout shows every stopped and
recordless run with a plain line, no stack trace. Nothing further needed to
check this card.

## Verdict: on track

The bet held, the fix generalized past the two runs the card originally named
to all 13 that existed by triage time plus the one added since.

## Proposals

None. No card to add, close, split, or reorder. ACT-40 stays on m-5 as doc-12
already decided.

## Kaizen candidate

The reflect session read the milestone state from doc-7 and doc-12 rather than
from the board, and reported two Done cards as open. A reflect that checks
each card it names against `backlog task view` before writing would have
caught it.
