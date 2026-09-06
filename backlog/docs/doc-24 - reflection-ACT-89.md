---
id: doc-24
title: 'reflection: ACT-89'
type: other
created_date: '2026-09-06 13:03'
---

Note first: this ID was reused. An earlier ACT-89 (a bun-pin duplicate of
ACT-84) was archived at commit `c6e2dba`, 03:16. A later filing at `b4cbca0`,
14:45, reused the number for this unrelated defect. This reflection is about
the second one, the card that is actually Done.

## 1. What is the target condition?

Milestone m-1 (doc-6/doc-7): prove the benchmark loop once, well enough that
a run, an instruction edit, a replay, and a comparison can be trusted. The
bet this card made, from its own filing: session checks (`tool-calls`,
`files-read`) should grade only the turn under test, not a seeded transcript
prefix. It was found as a side effect of regenerating ACT-73's baseline, with
direct evidence: a one-turn reply that made no tool calls scored 211, because
the check counted the whole transcript including 1268 lines of seeded
history.

## 2. What is the actual condition now?

Matches the bet. `recordAttempt` now slices the transcript at
`declaration.transcript.cut` before computing `toolUses`, so both
`tool-calls` and `files-read` (which read the same evidence) score the turn
under test. Verified against the exact real record the card cited: the same
run that scored 211 before the fix scores 0 after it, and an independent
re-run against the live model (`936e9ee1`) confirms it end to end, all three
checks passing. Six-axis review found two more gaps in the same area
(files-read through a prefix case, the no-prefix path through a real check)
and closed both in the same session. Full suite, lint, typecheck, format all
clean.

## 3. What obstacles stand between here and the goal, and which one is next?

This card removed one source of false grading in the loop: a session case
with a seeded prefix could fail or pass a check for reasons that had nothing
to do with the turn being graded. That obstacle is gone.

The next one is the sibling defect this same investigation surfaced and did
not fix: ACT-73. `stale` reports a byte-identical corpus file as changed,
and the investigation this card grew out of shows the original evidence for
it is gone (the recorded run was git-ignored and never persisted, and the
corpus file it named has since changed). ACT-73 now says plainly that it
needs either a run recorded against the old file version, or a test that
drives the hash comparison directly. Both ACT-89 and ACT-73 came from one
session regenerating one baseline; the corpus-comparison path (used by
`stale` and by replay's invalidation) is where the loop's trust is still
thin.

## 4. What is the next step, and what do you expect from it?

Take ACT-73's own recommendation: write a test that drives the hash
comparison directly with a controlled, known-changed and known-identical
file pair, rather than trying to recover the exact byte-identical condition
from a deleted run. Expect it to either reproduce the false positive (real
bug, now with a reliable repro) or fail to reproduce it (the bug was
specific to the deleted run's now-stale hash, and the comparison logic is
sound). Either answer is usable; right now neither exists.

## 5. When can João go and see?

Now, for this card: `mise exec -- rehearsal run --case brief-reply-92b2e8b0
--model sonnet` and read the `tool-calls` check on the result. Not yet for
ACT-73: nothing reproduces the stale false positive on demand today.

## Verdict: on track

The bet held, matched the goal (trustworthy checks feed a trustworthy
comparison), and was verified against real data, not just unit tests over
fakes. No case for pivot; m-1's plan stands.

## Proposals

- No new card. ACT-73 already exists, already carries the corrected
  diagnosis and the two options to resolve it, and is next in the m-1 queue
  per doc-23. Nothing here changes its priority or scope.

## Kaizen

None beyond what doc-22 already recorded (the ID collision is a filing
process gap, not this card's).
