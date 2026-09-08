---
id: ACT-104
title: render comparison spread as an interval with a per-measure reading verdict
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-08 21:12'
labels: []
dependencies:
  - ACT-49
priority: medium
ordinal: 100008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's 'What moved' comparison layout shows, per measure, a spread across attempts as an ASCII interval (arms overlap by 2 steps) and a glyph-plus-phrase reading (inside rerun noise / fires less often / clearest movement). comparison-quality.ts's QualityContrastEstimate carries paired successRate and passK estimates per contrast; nothing renders or computes an interval representation or a categorical reading verdict from them. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison report states, per measure, a spread across attempts in a form a UI can render as an interval
- [ ] #2 A comparison report states, per measure, one of a small fixed set of reading verdicts derived from that spread
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ambiguity found 2026-09-07: the card's 'spread across attempts' and the quantity the harness computes are not the same thing. Settled below, decision 1.

Triage 2026-09-08 (e): citation drift only. buildPairedEstimate is at comparison-estimator.ts:54, not the :57 originally cited.

Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Design decided 2026-09-08 by advisor review (Fable 5.1, unprimed) plus direct
verification of every load-bearing claim. The four answers below are settled
constraints for whoever builds this; do not reopen them.

1. What the interval represents. Within-arm spread across reps, per case per
measure. NOT the contrast's PairedEstimate.standardError, which is dispersion
across benchmark cases and measures a different thing. Two facts rule the
existing field out. comparison-quality.ts:104-107 hands buildPairedEstimate
single-element arrays ([minuend.successRate]), so rep-level variation never
reaches the estimator at all; and comparison-estimator.ts:57 throws below two
cases, while the design's scenario is one checkpoint and one task. A committed
test at comparison-quality.test.ts:138 asserts standardError of exactly 0 for
a two-case contrast, so an interval drawn from it would render a point and
assert certainty from two numbers.

The dispersion the harness already records is ReliabilitySummary
(confirmation-report.ts:27-38), per case per arm: gradeDistribution across
reps, successful/requested, and a binomial standardError over reps. Per
measure kind: graded stages take low and high grade from gradeDistribution on
the STAGE_LETTER_GRADES scale, which is what the design's "arms overlap by 2
steps" measures; binary measures take successful/requested as a count, the way
SPEC 5b counts blockers rather than grading them; meters take the spread of
the per-rep values array in comparison-resources.ts. PairedEstimate keeps its
existing role on the Attempt pairs screen, labeled as across N cases, and is
not redefined.

2. Where it is computed. Derived at serve time from the persisted record,
following src/server/comparisons.ts:21-40, which derives attribution the same
way and states the rule: a server-owned contract, not something the browser
re-derives. No schema version bump, since every input is already in the
record. This settles AC #1's "a comparison report states" as the served
report.

3. Row key. Per (case, measure), on the candidate-vs-baseline contrast.
The design's table is one case; the harness's report holds two or more.
Pooling reps across cases would mix case difficulty into what the row calls
rerun noise. Precedent: commit e279864, the pairing unit the report can
render is the case.

4. The reading vocabulary, and what is NOT built. Build the closed set
derivable from one row's two arm summaries: inside rerun noise (spread
overlap), unchanged already clear (both arms at ceiling), and a directional
magnitude for meters when both arms are AVAILABLE, with the UNAVAILABLE
branch yielding no phrase rather than a number. Test the binomial edges at
0/n and n/n, where the Wald standard error is zero.

Two SPEC phrases are out of scope here, each for its own reason.
"fires less often" is a hard-blocker reading, and no per-blocker result
exists on the rep record: judgedStageSchema (confirmation-record.ts:28-35)
carries stage, status, grade, verdict, elapsedMs, evidence and nothing more.
That needs a new card for per-rep blocker firings, not this one.
"clearest movement" is a superlative over the whole table, not a function of
one row, so it is a table-level highlight and belongs to its own card.

5. Scope. Report data only. The client's What moved block stays a
PlannedFeatureBlock (comparison-page.tsx:172-179, pinned by
comparison-page.test.tsx:150-160). ACT-50 deferred this screen to ACT-104 by
name while shipping Attempt pairs only, and every card filed from ACT-49's
inventory is a data-shape card. Note for whoever picks up the screen card:
the planned-block copy says a paired estimate cannot supply the interval yet,
which this card makes false.

The card's title says "render" while its acceptance criteria say report data.
The acceptance criteria govern.

Card premise corrected: the note above calling meanDelta +/- 1.96*standardError
a routine default does not hold for the contrast estimate. At two cases the
interval can be zero-width, and 1.96 is a large-sample multiplier being applied
at one degree of freedom. It is not the basis for this card's interval.
<!-- SECTION:NOTES:END -->
