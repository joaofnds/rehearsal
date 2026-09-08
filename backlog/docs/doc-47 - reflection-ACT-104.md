---
id: doc-47
title: 'reflection: ACT-104'
type: other
created_date: '2026-09-08 21:44'
---

# Reflection: ACT-104

## 1. Target condition

ACT-104 carries no milestone tag; it was filed from ACT-49's design-vs-harness
inventory (2026-09-07) as one of ten backend gaps between the exported design
and the harness. It feeds m-7 ("read a comparison and decide whether an edit
helped", doc-7), which needs real per-measure quality readings before the
comparison screen can render its "What moved" view. The card has no separate
dated pick note; its own "Bet, 2026-09-08" line records that iterate picked it
first from the ready queue, and that line is the bet. The bet: make the served
comparison report state, per measure per case, a grade-span interval and one
of a closed set of reading verdicts (inside rerun noise, unchanged already
clear, or a named-direction separation), derived from already-persisted
`ReliabilitySummary` data, with no UI change.

## 2. Actual condition now

The bet held exactly. Verified directly this session, not from the card's own
account:

- `comparisons.ts`'s `comparisonReport` now returns a `qualityReadings` field
  keyed by case, then arm-pair, then measure name, each holding an interval
  and a verdict. Confirmed by reading the wiring and its import of
  `qualityReading`.
- The client's comparison page still renders `PlannedFeatureBlock` for the
  "What moved" tab (`comparison-page.tsx:172-178`), unchanged, matching AC #10
  exactly. No client file in the two feature commits.
- Fresh full-suite run this session: 1277/1277 root tests pass, 100/100
  client tests pass, matching the card's claimed green run.
- All 10 acceptance criteria have code and test evidence on the card; two
  correctness bugs (a tie-break misattribution, a throw on empty
  `gradeDistribution` reachable through the live server path) were caught by
  a six-axis independent review and fixed before close, with new tests.

No gap between the bet and what's observable.

## 3. Obstacles and what's next

No obstacle in this card's own path; it closed clean on the first build pass
plus one review-driven fix round. What it explicitly left undone, correctly,
per its own decision 5: the two SPEC reading phrases ("fires less often",
requiring per-rep blocker data not yet on the record; "clearest movement", a
table-level highlight, not a per-row function) are out of scope and need their
own cards if wanted. Neither is filed yet; nothing on the open board claims
them.

The obstacle the card removed: the comparison screen's "What moved" tab had
no backend data to render against. That's gone. What remains between here and
m-7's goal is the UI work itself, unclaimed by any open card right now.

## 4. Next step and expected observation

No existing card builds the "What moved" UI against the new `qualityReadings`
field. ACT-50 (m-7, narrowed to comparisons and corpus screens per doc-7) is
the closest candidate on the board, but it was scoped before this data
existed and its own text should be checked against what's now available
before someone builds from it. Proposing a new card: wire the comparison
page's "What moved" tab to render the interval-and-verdict data
`GET /api/comparisons/:digest` now serves, replacing its `PlannedFeatureBlock`
placeholder. Expected observation: opening a comparison in the browser shows,
per measure per case, an interval and a plain-language verdict instead of the
placeholder copy.

## 5. Where the increment can be seen

Not yet from a browser: the served field has no renderer. It can be seen now
by calling `GET /api/comparisons/:digest` against a real recorded comparison
and reading the `qualityReadings` field directly, or by reading the passing
`comparisons.test.ts` assertions. The card's own noted gap: the "unreached
measure" (empty `gradeDistribution`) path is unit-tested but not exercised
against a live persisted record, since no fixture in the repo currently
produces an all-NOT_REACHED stage for one arm. That's an honest limit, not a
defect: nobody has hit it in a real run yet.

## Verdict: on track

The bet held, matches m-7's goal, and the review round caught two real bugs
before close rather than after. The board has no next card yet for the UI
side; that's this reflection's proposal, not a gap in the closed card.

## Proposals

- Add a card: wire the comparison page's "What moved" tab to
  `qualityReadings`, replacing the `PlannedFeatureBlock` placeholder, per m-7.
  Check ACT-50's existing scope against this new field first, since ACT-50
  may already be the right home rather than a new card.
- No reorder, no split, no card to close.

## Process/structural notes

None. This run's own findings were all confirmations, not defects.
