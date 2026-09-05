---
id: doc-18
title: 'reflection: ACT-40'
type: other
created_date: '2026-09-05 22:45'
---

# Reflection: ACT-40

## 1. What is the target condition?

ACT-40 belongs to m-5, "see one screen of real data, and say what is wrong
with it." Before this card, m-5 was 1/5 done. The board's own order (doc-7,
carried into doc-16) puts m-5 second overall, right after m-1's loop-proving
work closed, ahead of m-2 and m-3.

ACT-40 has no separate pick-step bet note; its own description is the bet:
`list attempts` should stop leaking a raw filesystem error for every litter
directory a crashed run leaves behind, and instead say plainly that the
attempt is incomplete, since the tool must eventually show one screen of
real run data without garbage lines mixed into it.

## 2. What is the actual condition now?

Matches the bet exactly, verified live in this session and not only from the
card's own claim: `list attempts` prints six plain `incomplete: no
attempt.json recorded` lines where six raw ENOENT lines printed before,
mixed cleanly with the real attempt and stage records in the same output.
The build session's baseline count (five) was itself wrong and corrected to
six on the card before closing; the corrected count is what I reproduced.

A parse failure on a record that exists but is corrupt still throws its own
distinct message, unchanged, which is what criterion #3 required and what
the overseeing session verified by planting invalid JSON directly.

## 3. What obstacles stand between here and the goal, and which one is next?

The run met no stopped step and no budget wall; it closed clean, with a
João decision recorded on-card (report incomplete, don't omit) that
resolved the one open question criterion #2 needed.

It also surfaced a new obstacle one lister over: `list checkpoints` has the
identical defect (no existence check before parsing a checkpoint record),
now filed as ACT-85, not fixed here since it was out of this card's scope.
The fix pattern is already proven and reusable.

The next obstacle for "one screen of real data" is no longer this defect.
It's that `list attempts` remains a terminal command; m-5's own screen work
(ACT-48 through ACT-53) hasn't started, and ACT-85 is a small known gap
sitting in front of it.

## 4. What is the next step, and what do you expect from it?

Fix ACT-85 next: apply the same existence-check-before-parse pattern to
`listCheckpoints` that ACT-40 applied to `listAttempts`. Expect the same
shape of result, a plain incomplete reason in place of a raw ENOENT, and a
live before/after run against a checkout holding an empty checkpoint stage
directory. It's small, the pattern is proven, and it clears the last known
raw-error leak before m-5's screen work (ACT-48 onward) starts building on
top of `list`'s output.

## 5. When can João go and see?

Now. `mise exec -- ./rehearsal.ts list attempts` on this checkout shows the
fixed output directly, no setup needed.

## Verdict: on track

The bet held exactly, m-5 gained a real fix with nothing left open, and the
one thing it exposed (ACT-85) is already on the board with the fix shape
named. No evidence here touches the milestone order or the goal itself.

## Proposals for triage

- Add priority to ACT-85: it's the same defect class as ACT-40, same fix
  shape, cheap. Recommend Medium, ahead of the unprioritized m-3 cluster
  but behind m-5's own screen cards (ACT-48/49/52/53), since it's a small
  cleanup gap in front of them, not the work itself.

## Kaizen candidate

The card's own reproduction count was wrong (five stated, six actual) and
was only caught because the build session re-ran the command itself before
fixing. A card's reproduction step should be re-run at pickup, not trusted
from its description, before counting on its numbers.
