---
id: doc-11
title: 'reflection: ACT-65 2026-09-05'
type: other
created_date: '2026-09-04 22:50'
---

# Reflection: ACT-65, 2026-09-05

## 1. What is the target condition?

ACT-65 belongs to no milestone field of its own, but sits directly on the path
to m-1 ("prove the loop once", doc-6/doc-7), as a defect found while reviewing
ACT-41, m-1's own gate card. ACT-41's bet was that a stage session reads the
harness's frozen corpus instructions rather than the target repository's own.
ACT-65's bet, stated on the card: a confirmed replay's recorded corpus
CLAUDE.md hash matches the bytes the replayed session actually reads, and
editing the live corpus between checkpoint and replay cannot change that. The
card also widened, by João's direction, to cover the original run path, not
only replay.

## 2. What is the actual condition now?

The bet held. `installStageCorpusSnapshot` (checkpoint.ts:270) now copies the
snapshot's CLAUDE.md into `<targetDirectory>/.claude/CLAUDE.md`, the same
function both the original run (pipeline-confirmation.ts:388) and confirmed
replay (replay-confirmation.ts:417) call, so one four-line change closes both
paths. It writes only under `.claude/`, never to the worktree root, so ACT-41's
fix (stop overwriting the target's own project instructions) is not undone.

I read the commit (6098f6b) directly. The unit test asserts the installed
file's bytes equal the frozen instructions string; the integration test runs
the real snapshot-then-install path for three concurrent confirmed-replay reps
and confirms no cross-rep leakage. All four acceptance criteria are checked,
the full suite, typecheck, lint, and format pass. Nothing on the card overstates
its evidence: it correctly flags that no live `claude` CLI session was run
against the installed file, and that the delivery mechanism itself was
verified separately, by empirical probe, before build started.

## 3. What obstacles stand between here and the goal, and which one is next?

Fixing this closed the last known reason a stage session's recorded corpus
could diverge from what it actually read. What is next is not another fix
here: it is running ACT-39, which has waited on exactly this class of defect
being closed. ACT-39 depends on ACT-38 (done) and ACT-41 (done); ACT-65 was
found inside ACT-41's own review and removes a way that dependency chain could
still have been silently false.

One obstacle the card surfaced and correctly did not try to close:
`captureStageCorpus`/`snapshotStageCorpus` still take instructions as a bare
string instead of resolving them from roots like every other corpus kind. That
asymmetry is what let this bug exist undetected; it is filed as ACT-68 and
depends on ACT-65, correctly left open rather than folded in.

## 4. What is the next step, and what do you expect from it?

ACT-39: replay one stage against an edited instruction and read the
comparison. It is already on the board, in To Do, high priority, at the head
of the ready queue, both its dependencies Done. Nothing here proposes a new
card. The expectation ACT-39 itself states is the right one: answer "did that
edit improve the stage" from the tool's own output, or record it as
unanswerable and name what was missing.

ACT-68 (instructions taken as a string, not resolved from roots) is real but
not urgent: it is a latent-defect-class risk, not a blocker, and correctly
carries no priority yet.

## 5. When can João go and see?

Now, for this card: `git show 6098f6b` shows the fix, and
`bun test src/benchmark/checkpoint.test.ts src/benchmark/replay-confirmation.test.ts`
reproduces the two tests that pin it.

Not yet for the goal itself: no comparison has been produced by ACT-39, so
there is nothing yet to open that answers the project's own question. That
remains the thing to go and see once ACT-39 runs.

## Verdict: on track

The bet held, and the fix is confined to what the card scoped. The next step
(ACT-39) is already queued and correctly ordered; this reflection changes
nothing about the plan doc-7 already set.

## Proposals

None. ACT-68 is already filed and correctly scoped as a follow-up, not folded
into this fix. No card is overtaken, superseded, or newly needed.

## Kaizen

None. No process gap: the card's own scope note (asking João whether to widen
to the original run path) is the process working as intended, not a defect.
