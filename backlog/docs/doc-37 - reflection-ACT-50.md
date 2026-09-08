---
id: doc-37
title: 'reflection: ACT-50'
type: other
created_date: '2026-09-08 01:45'
---

# Reflection: ACT-50

## 1. What is the target condition?

ACT-50 is the sole card of m-7, "Read a comparison and decide whether an edit
helped" (doc-7). Doc-6/doc-7's overall order: prove the loop once (m-1), then
m-5, m-6, m-7 in sequence, then m-2, then m-3. m-7 is the last of the three UI
milestones and, per doc-7, "the product's own question rendered" — the screen
that lets João look at a real comparison record and judge whether a corpus
edit helped.

The card's own bet, from its scope decisions (2026-09-07): ship the
Attempt-pairs comparison view and the corpus screen, both reading only what
the harness already persists on disk, deferring What-moved to ACT-104. The
card's plan noted the risk directly: "No comparison record exists on disk
today (.benchmark-runs/comparisons is empty), so the comparison screen is
built and tested against fixtures unless a real compare run is produced
first."

## 2. What is the actual condition now?

Both screens are built, reviewed (two rounds, six axes each), and Done.
Verified myself this run: the corpus API, hit live, returns real data
correctly scoped to the corpus layout (120 files across CLAUDE.md, skills,
agents, output-styles, rulebook), not the 7020-file raw root the pre-fix
version leaked. A crafted 64-`9` comparison digest returns a clean 404,
matching the not-found branch the client renders.

`.benchmark-runs/comparisons` is empty on this machine right now. The
card's own risk landed: the comparison screen has been seen rendering
fixtures in tests and the empty/not-found state live, never a real
comparison. m-1's ACT-39 ("replay one stage against an edited instruction and
read the comparison") is marked Done, so the loop has produced at least one
real comparison somewhere, but no comparison record exists in this
checkout's `.benchmark-runs` today, whether because ACT-39 ran elsewhere, its
output was not retained, or something else. That gap is unprobed beyond what
I checked directly, so I name it as a question rather than a diagnosis.

Card handoff also names four defects the build session found only by looking
outside the test suite: two live-browser-only bugs (corpus root over-scoped
to 7020 files, a blank page on a missing comparison because every client
test built its own retry-disabled QueryClient and never ran the shipped
config), one review-only bug (dedup false-refusing a genuine single-file
edit), one crash-only bug (an incomplete checkpoint 500ing the corpus
route). All four are fixed and each has a reverting test.

## 3. What obstacles stand between here and the goal, and which one is next?

The obstacle the run met: no real comparison to build or verify against, so
Attempt-pairs shipped against the report schema and fixtures, correctly
by the card's own scope decision, but unconfirmed against what a real
compare run actually produces on screen.

What the handoff says became possible and is not wired: ACT-104 (What-moved,
the interval-plus-verdict presentation) and ACT-109 (per-attempt rows,
needs a schema change to carry per-rep grades) are both named as the next
layer on top of what shipped. ACT-110 (invalidated count) and ACT-113
(symlink containment in hashDirectory, pre-existing, not introduced here)
are tracked but don't block reading a comparison.

The next obstacle is not a card to build, it's a fact to establish: whether
a real comparison record exists anywhere, and if not, producing one is what
actually finishes proving m-7's premise, the same way ACT-38/ACT-39 proved
m-1's.

## 4. What is the next step, and what do you expect from it?

Produce a real comparison (a rehearsal `replay` against a genuinely edited
corpus, or locate ACT-39's original output if it survives on another
machine or branch) and open the comparison screen against it. Expect one of
two outcomes: the Attempt-pairs view reads correctly, closing the one check
the card's own risk note left open, or it surfaces a fifth defect the fixture
tests couldn't reach, the same pattern as the two browser-only bugs already
found in this card. Either outcome is informative; not doing it leaves m-7's
central screen unverified against the one kind of data it exists to show.

This is not a new card by itself, since no schema or code change is implied
until the check is run, but if the check surfaces a defect, that defect gets
its own card the way the browser check did for ACT-50.

## 5. When can the increment be seen?

Today: `bun run serve` plus the client dev server, then `GET /api/corpus`
and any `GET /api/comparisons/:digest` for a 404 or fixture case, exactly as
this reflection and the card's own browser check did.

Not yet there: opening the comparison screen against a real, non-empty
comparison record. That requires either finding where ACT-39's comparison
output went or running a fresh replay to produce one.

## Verdict: On track

The bet held for what it scoped: two screens, reading real data, with two
review rounds and a live browser check finding and fixing defects the test
suite couldn't see. The goal itself (m-7's ordering, and the UI-three
sequence in doc-7) is unchanged by this run. The one thing to adjust is not
the plan but the check: the card's own noted risk (fixtures instead of a
real comparison) should be closed out rather than carried forward silently
into whatever screen comes next.

## Proposals

- Add a card (or a checklist item on whichever card produces the next real
  compare run): open the comparison screen against a genuine, non-empty
  comparison record and record what was seen, closing the gap this
  reflection found. Cheap, and the natural pairing is whatever session next
  runs `rehearsal compare` for real, since m-1's ACT-39 already proved this
  is possible once.
- No card to close or split; ACT-104, ACT-109, ACT-110, ACT-113 are already
  filed and correctly scoped as follow-ons, not overtaken by anything this
  run found.

## Kaizen candidate

None new. The three carried in doc-33/doc-36 are unchanged by this card.

## Process note

`.benchmark-runs/comparisons` being empty on this checkout despite ACT-39
(m-1) being marked Done is worth someone's attention: either the record
lives elsewhere (a different machine, an ignored path, a replay run that
wasn't committed as a fixture), or "Done" on ACT-39 rests on a comparison
that no longer exists to point at. I did not chase this further since it is
outside this card; naming it here so the next session that touches m-1 or
m-7 doesn't have to rediscover it.
