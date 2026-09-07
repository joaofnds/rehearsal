---
id: doc-29
title: 'reflection: ACT-37'
type: other
created_date: '2026-09-07 11:48'
---

# Reflection: ACT-37, 2026-09-07

## 1. Target condition

The board's goal (doc-6, unchanged through doc-28): prove the loop once
(m-1), then the UI three (m-5, m-6, m-7), then m-2, then m-3. ACT-37 carries
no milestone.

The bet, from doc-28's queue entry: ACT-37 was picked first from the ready
queue by iterate because its blocking premise (an open direction question on
ACT-28) turned out to be stale — João had already answered it via DOT-36 and
decision-4. The bet was narrow: build the harness-owned settings file now
that nothing blocks it. It named no observation about the milestone goal,
because the card sits outside every milestone.

## 2. Actual condition now

Built and closed, verified directly this session: working tree clean, four
commits plus a close commit at 87c5f4d, full suite fresh at 1086/1086,
typecheck and lint clean per the card's own record. A stage session can now
declare a settings file carrying only the permissions deny list and feature
switches, reaches the real session through the existing `--settings` flag,
carries no hooks key anywhere in the harness, and hashes into its own
lineage field separate from `corpusFiles`. Six-axis review ran before Done;
four should-fix findings were fixed in the same pass, one escalated and
accepted by João.

Separately, checked live: `list runs` shows one real run, stopped at build,
labeled "not replayable" despite having usable checkpoints — the defect
ACT-87/ACT-91 already name. `list groups` and `list comparisons` are both
empty. This is not new evidence that the loop is broken; ACT-39's own record
shows the loop was walked once by hand in 2026-09-05, before the automated
comparison feature existed, and that evidence is not visible from today's
`list` output because the artifacts it read are gone. The bet and the
observation don't diverge, since the bet made no claim about the loop.

## 3. Obstacles and what's next

ACT-37 met no obstacle; it built cleanly against a settled decision. The
obstacle is upstream of this card: the goal's own walking skeleton (m-1) has
no run on record today that reaches a stage judge and produces a comparison
a person can read. The one live run stopped at build and is mislabeled as
unreplayable, so even resuming it is blocked by ACT-87/ACT-91's defect
first.

ACT-37's own handoff names one gap outside its four acceptance criteria:
`rehearsal stale` does not yet compare a settings-file digest for pipeline
checkpoints, so a settings-only edit reports as fresh when it should
invalidate lineage. No card exists for this yet.

## 4. Next step

Two independent items, neither new:

- ACT-91 (already filed, To Do, no priority): the stopped run with usable
  checkpoints is mislabeled "not replayable." Fixing it is the direct route
  back to a resumable m-1 run, since the only real run on record is exactly
  this case.
- A new card: `rehearsal stale` should hash a pipeline checkpoint's settings
  file the same way it already hashes `corpusFiles`, so a settings-only edit
  is reported stale instead of fresh. This is ACT-37's own named gap, not
  covered by any open card.

Recommend triage assign ACT-91 priority (doc-28 already recommends Medium,
for the same reason: the stopped run is the case an operator most wants to
replay) and file the settings-staleness gap as a new card, no milestone,
Medium, dependent on nothing.

## 5. When can the increment be seen?

`rehearsal list runs` and the settings file at `cases/audit-log/` (or the
harness default `stage-settings.json`) are there now: a declared or default
settings file, and its digest visible in a checkpoint's lineage. What is not
there yet: a `list comparisons` row a person can read today, since the one
comparison this project ever produced was read by hand from two JSON
artifacts, not through the compare command, and those artifacts are gone.

## Verdict: on track

The bet held: ACT-37 built exactly what its settled decisions specified, and
review confirmed it. It carries no observable relationship to the m-1 goal
either way, since it never claimed one. The goal itself is unchanged and the
next step (ACT-91, then the new staleness card) continues it.

## Proposals

- Add: a card for `rehearsal stale` comparing a pipeline checkpoint's
  settings-file digest, the gap ACT-37's own handoff names. Not yet filed.
- Reorder: none. ACT-91 is already queued next among the small defects in
  doc-28; this reflection adds no reason to move it earlier than that queue
  already has it, beyond confirming live that the mislabeled run is the
  project's only real pipeline evidence.

## Kaizen candidates

None from this card's own run. The recurring gap doc-26/doc-27/doc-28 already
named (m-1 reliability cards closing on inference over shared code rather
than a live pipeline run) still stands; this reflection adds no new instance.
