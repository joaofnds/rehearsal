---
id: doc-31
title: 'reflection: ACT-87'
type: other
created_date: '2026-09-07 13:26'
---

# Reflection: ACT-87

## 1. What is the target condition?

ACT-87 belongs to m-5, "see one screen of real data, and say what is wrong
with it." Its bet is its own description: `list runs` should stop leaking a
raw ENOENT for a stopped run with no manifest, and instead report it as
incomplete through the existing unreadable-record path, the same pattern
ACT-40 and ACT-85 already proved on the sibling listers.

## 2. What is the actual condition now?

Matches the bet. `listRuns` now catches `loadRunManifest`'s rejection at the
call site and re-throws an `incomplete: no manifest.json at <path>` reason
instead of letting the raw ENOENT reach the operator. The build session's
first design (a second existence check ahead of the call) was replaced with
reusing `loadRunManifest`'s own check via `.catch`, after architecture review
flagged the duplicate check as permanently unreachable. Full suite fresh:
1088 pass, typecheck and lint clean; the targeted suite (28 tests) passes on
its own re-run this session. No stopped run with a missing manifest exists on
this checkout to reproduce the raw ENOENT live; the fix's before/after rests
on the card's own review record (a planted fixture, mutation-verified), the
same limitation ACT-85's reflection carried for its own case.

The card's stated root cause was stale: `loadRunManifest` already had its own
existence check before this task. The real gap was narrower, that `listRuns`
didn't route that check's failure through `collect`'s `incomplete` shape, so
it reached the operator as `loadRunManifest`'s own wording. The fix corrects
that narrower gap, not the one the card described.

## 3. What obstacles stand between here and the goal, and which one is next?

None from this card. It closed clean with a review pass and no open
question. It also closes the raw-ENOENT class across all three listers
(ACT-40 for attempts, ACT-85 for checkpoints, ACT-87 for runs), and the
sibling wrong-label defect on the same call site (ACT-91, stopped runs
mislabeled not-replayable) is independently closed too, verified live this
session: `list runs` now prints `replayable` for the run named on that
card's acceptance criterion.

The next obstacle for "one screen of real data" is what ACT-40's and ACT-85's
reflections already named: `list attempts`, `list checkpoints`, and `list
runs` are still terminal commands. m-5's own screen work hasn't started.

## 4. What is the next step, and what do you expect from it?

ACT-48, already top of the ready queue and m-5's own entry point: settle the
vocabulary the design introduces against the glossary. It gates ACT-50, 52,
53 (the design system and the screens themselves). Expect a glossary that
resolves the design doc's terms, with no downstream screen card blocked on
an undefined term.

## 5. When can the increment be seen?

Now. `mise exec -- ./rehearsal.ts list runs` on this checkout shows the fixed
output directly (no raw ENOENT, correct replayable label), no setup needed.

## Verdict: on track

The bet held, matching ACT-40's and ACT-85's reflections exactly. The
raw-ENOENT defect class is now closed everywhere it was known to exist.
Nothing here touches the milestone order or the goal itself.

## Proposals for triage

- No new card. The known cleanup gaps in front of m-5's screen work
  (ACT-40, ACT-85, ACT-87, ACT-91) are all closed. ACT-48 is the correct
  next pick for this lane and is already queued first.

## Kaizen candidate

None new. The card's own notes already caught and corrected its stale root
cause before build, and the architecture review round caught the
unreachable-duplicate-check risk before it shipped. No further process gap
surfaced this run.
