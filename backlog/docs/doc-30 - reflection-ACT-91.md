---
id: doc-30
title: 'reflection: ACT-91'
type: other
created_date: '2026-09-07 12:49'
---

# Reflection: ACT-91

## 1. Target condition

Milestone m-1: prove the loop once (run a stage, edit an instruction, replay,
read a comparison). ACT-91's bet, from doc-28's triage (2026-09-07): a stopped
run whose manifest and checkpoints already exist should be labelled
replayable, because a stopped run is the case an operator most wants to
iterate on, and the wrong label was actively telling them not to.

## 2. Actual condition

Matches the bet. `list-command.ts`'s stopped-run branch now returns
`"replayable"` once `loadRunManifest` succeeds, the same fact the non-stopped
branch already used. Confirmed directly this session: a fresh `list runs`
against the run named in the AC (`2026-09-06T21-58-29.508Z`) prints
`replayable`, not the prior `not replayable`. Full suite fresh: 1087 pass, 0
fail. The card's own record of a 2551651 fix commit and an e1889d8
review-fix commit (adding a mutation-verified test for the manifest-missing
sibling branch) checks out against `git log`.

## 3. Obstacles and what's next

None remain for this card; it closed clean including the review round. The
run also surfaced a scheduling friction, not a defect: the shape session's
own bookkeeping (setting assignee `@claude` per the board rule) tripped
`iterate step`'s two-session guard, stopping iteration before the build
session picked it up manually. No card exists for that friction; it's a
kaizen candidate, not a next build step.

The real next step sits one card over. ACT-87, still To Do, is the sibling
defect at the same call site: a stopped run with no manifest at all throws a
raw ENOENT instead of reporting incomplete, on the same line ACT-91 just
fixed. It's already shaped, already queued behind ACT-91 in doc-28
(item 9), and no design choice remains on it either.

## 4. Next step and expected observation

Build ACT-87. Expect: `rehearsal list runs` against a stopped run with no
manifest.json prints an "incomplete" reason through the existing
unreadable-record path, with no raw ENOENT reaching the operator, and the
control-root redaction test still fails when its path-redaction is removed
(AC #3 on that card).

## 5. Where to see it

`rehearsal list runs` against `.benchmark-runs`, run `2026-09-06T21-58-29.508Z`,
right now: prints `replayable`. Already visible, no further action needed to
see this increment.

## Verdict

**On track.** The bet held exactly: the label was wrong, the fix was the
one-line change the shape session predicted, and review found real
follow-on gaps (a stale test name, an uncovered sibling branch) that got
fixed in the same pass rather than left behind.

## Proposals

- No card to add for the fix itself; ACT-87 already exists, is already
  queued next in doc-28, and needs no changes.
- Kaizen candidate: the iteration guard fires on a session's own
  bookkeeping (setting `@claude` per the board's pickup rule) rather than on
  another session actually holding the card. Worth a named check in kaizen
  for whether the guard should distinguish "assignee set by the session
  currently running" from "assignee set by a different, possibly dead,
  session."
- No structural opportunity in the code beyond what review-code already
  disposed of on this card.
