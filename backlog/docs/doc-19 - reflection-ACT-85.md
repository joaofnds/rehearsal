---
id: doc-19
title: 'reflection: ACT-85'
type: other
created_date: '2026-09-05 23:10'
---

# Reflection: ACT-85

## 1. What is the target condition?

ACT-85 belongs to m-5, "see one screen of real data, and say what is wrong
with it." Its bet is named directly by ACT-40's own reflection (doc-18),
which proposed this card: apply the same existence-check-before-parse
pattern that fixed `listAttempts` to `listCheckpoints`, so a checkpoint
stage directory holding no `checkpoint.json` is reported as incomplete
instead of leaking a raw ENOENT. Expected result: the same shape as
ACT-40, a plain incomplete reason in place of the filesystem error.

## 2. What is the actual condition now?

Matches the bet exactly. The fix is in (commit 22bcc89) and its review
record shows a live before/after: the same command that used to print the
raw ENOENT now prints a plain incomplete reason, confirmed by the reviewer
reverting the production fix and re-running the test both ways. A stale
fixture comment describing the old ENOENT behavior was caught by four
independent review axes and fixed in the same pass (0dd184d). I re-ran the
targeted suite myself this session: 26 pass, 0 fail. I did not have an
empty checkpoint stage directory on this real checkout to re-trigger the
live case myself; the review's planted-case evidence is what stands for
that check.

## 3. What obstacles stand between here and the goal, and which one is next?

The run met no stopped step and no budget wall. It surfaced one obstacle
one lister over, exactly as ACT-40's reflection predicted this pattern
would recur: `listRuns`'s manifest read has the identical defect, no
existence check before parsing. That's already filed as ACT-87, so this
run needed no new proposal for it.

The next obstacle for "one screen of real data" is unchanged from ACT-40's
own reflection: `list attempts` and `list checkpoints` are still terminal
commands. m-5's screen work (ACT-48 through ACT-53) hasn't started, and
that is now the whole of what stands between here and the milestone,
unless ACT-87 is judged worth clearing first.

## 4. What is the next step, and what do you expect from it?

No new card is needed. ACT-87 (list runs, same defect, same fix shape)
already exists and is the natural next pick if the raw-ENOENT class is to
be closed everywhere before m-5's screen work starts. Otherwise m-5's own
queue (ACT-48 onward) is the next step, and ACT-87 waits alongside it.

## 5. When can João go and see?

Now. The review record on ACT-85 documents the live before/after; a fresh
empty checkpoint stage directory on a real checkout would show it again
directly, but none exists on this checkout to point at today.

## Verdict: on track

The bet held exactly, matching the prediction ACT-40's own reflection
made. Nothing here touches the milestone order or the goal itself.

## Proposals for triage

- No new card. ACT-87 already covers the one obstacle this run surfaced.
  If ACT-87 has no priority yet, recommend the same reasoning doc-18 gave
  ACT-85: Medium, ahead of the unprioritized m-3 cluster, behind m-5's own
  screen cards, since it's a small cleanup gap in front of them and not
  the work itself.

## Kaizen candidate

None new. ACT-85 was itself the correction to the process gap doc-18
flagged on ACT-40 (a lister's reproduction should be re-verified, not
trusted), and this run found no further instance.
