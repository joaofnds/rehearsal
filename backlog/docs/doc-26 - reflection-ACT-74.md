---
id: doc-26
title: 'reflection: ACT-74'
type: other
created_date: '2026-09-06 23:09'
---

# Reflection: ACT-74

## 1. What is the target condition?

Milestone m-1: prove the loop once, meaning a run/replay/compare cycle whose
comparison output can be trusted. This card's bet, per doc-23's queue line and
doc-25's own next-step proposal, was that ACT-74 (with ACT-73 and ACT-76)
blocks trusting the comparison m-1 exists to produce, independent of the other
two.

Concretely, doc-25 stated it as: a build-stage checkpoint should report stale
on an edit to a skill file the build stage read, the same way a shape-stage
checkpoint already does for CLAUDE.md, closing the last named gap in that
trust chain.

## 2. What is the actual condition now?

Matches the bet for the failure path, and holds by code-path reasoning rather
than observation for the completion path. Verified directly this run, not
just read from the card: the full suite (run-abort.test.ts and run.test.ts)
passes fresh, the fix commit (`558ceef`) threads the already-captured
`corpusFiles` into `writeStageJudgeFailure`, and `run.ts:734` spreads
`corpusFiles` into every stage's completion record with no branch by stage
name. Git tree is clean.

The card's own notes are honest about the shortfall the second commit
(`aac7de3`) exists to record: AC#2 (a build stage that clears its grade gate
records corpus files) is proven by a shape-stage test plus reading the shared
code, not by watching a real build stage clear a B gate and produce a
stale-detecting checkpoint. Nobody has done that yet, for any stage, in this
whole m-1 effort — every proof so far is unit or integration level over fakes.

## 3. What obstacles stand between here and the goal, and which one is next?

This card is closed and the failure-path defect it targeted is fixed and
observed. It leaves one obstacle it names itself: the completion-path claim
for a passing build stage rests on inference over shared code, not a live
run. That gap sits underneath all three of ACT-73/74/76, since none of their
"verified" claims include a real pipeline run reaching a stage judge on either
side of PASS/FAIL.

The other obstacle doc-25 named alongside this card, ACT-63 (staleness checks
the control repository's corpus root instead of the target's), is untouched
since filing and blocks the same trust goal independently of ACT-74.

## 4. What is the next step, and what do you expect from it?

Two candidates, not sequenced by dependency:

- ACT-63, already on the board, To Do, m-1, no priority. Fixing it should make
  `stale` and `replay` search the target's own corpus root, observable by
  pointing `--corpus` at a target-tree copy and confirming the right file
  responds instead of a control-repo file of the same name.
- A live run that actually exercises the gap doc-23 and this card both leave
  open: run the audit-log pipeline (or ACT-39's replay) far enough that a
  build stage both passes and fails its grade gate for real, and read the two
  resulting records to confirm `corpusFiles` is populated in each. This is not
  a new card's worth of code, it is the observation none of ACT-73/74/76 have
  produced yet, and it is the only thing that would upgrade "the shared code
  is unbranched" from inference to fact for the whole trust chain m-1 depends
  on.

Recommend the live run before ACT-63, since it costs the money m-1 was always
going to spend and either closes the inference gap on three cards at once or
finds a fourth defect while the trace is fresh.

## 5. When can João go and see?

Not yet. Nothing this card produced is watchable end to end: the fix is
proven by unit and integration tests over fakes, same as ACT-73 and ACT-76
before it. The live run in step 4 is what would let him open a real build
stage's record and see `corpusFiles` populated on both a pass and a grade
failure.

## Verdict

**On track**, with one caveat. The bet held: the failure-path defect the card
named is fixed and verified. But the card's own notes flag that its
completion-path criterion is inference, not observation, and that pattern now
repeats across all three closed reliability cards from this trace (ACT-73,
ACT-74, ACT-76). The goal itself does not change; the plan should add the live
run that none of the three cards individually justified on their own but that
their combination now calls for.

## Proposals

- Add a card (or fold into ACT-38/ACT-39's own next run): run the pipeline far
  enough that a build stage clears the grade gate once and fails it once,
  confirming `corpusFiles` on both resulting records by direct inspection.
  Targets the observation gap named in section 4, shared by ACT-73, ACT-74,
  and ACT-76.
- No change to ACT-63's placement; it is already correctly queued (m-1, To
  Do, independent).

## Kaizen / structural notes

Three cards in a row from the same ACT-39-prep trace (ACT-73, ACT-74, ACT-76)
closed with acceptance criteria proven by unit-level inference over shared
code rather than a live run, each one flagging the gap honestly in its own
notes. That is not a defect in any single card's work, but the repetition
across three siblings is a signal that m-1's "prove the loop once" goal is
being approached entirely through cards that harden the mechanism without yet
running the mechanism. Worth naming to João directly rather than leaving it
implicit in three separate card notes.
