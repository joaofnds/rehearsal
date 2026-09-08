---
id: ACT-104
title: render comparison spread as an interval with a per-measure reading verdict
status: Done
assignee:
  - '@claude'
created_date: '2026-09-07 16:29'
updated_date: '2026-09-08 21:41'
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
- [x] #1 A comparison report states, per measure, a spread across attempts in a form a UI can render as an interval
- [x] #2 A comparison report states, per measure, one of a small fixed set of reading verdicts derived from that spread
- [x] #3 Given a candidateMinusBaseline (or any contrast) quality row for a declared-stage measure whose two arms' gradeDistribution spans overlap, the served comparison report's row carries an interval field built from each arm's low-to-high grade span on the A-F scale and a verdict of "inside rerun noise"
- [x] #4 Given a declared-stage quality row whose arms both have successful === requested (every rep graded A or B, the only grades stageObservation in confirmation-report.ts counts as successful today), the row's verdict is "unchanged, already clear" regardless of grade spread
- [x] #5 Given a declared-stage quality row whose arms' grade spans do not overlap and are not both at ceiling, the row's verdict names the arm with the higher successful-of-requested count as succeeding more often
- [x] #6 Given the "final" row (pipeline mode), the interval and verdict are computed over the two-value PASS/FAIL axis from finalObservation's verdict field, not the five-letter grade scale, using the same three structural rules (overlap, ceiling, direction)
- [x] #7 The binomial edge cases 0/n and n/n (Wald standard error zero) are covered by a passing test for both the overlap and ceiling rules
- [x] #8 The served comparison report carries the interval-and-verdict field per measure per case (see open question below on where it is computed and stored)
- [x] #9 The computation reads the two arms' full ReliabilitySummary (gradeDistribution, successful, requested), not a narrowed successRate/passK pair and not PairedEstimate, and is keyed per (case, measure) per decision 3, never pooled across all cases into one interval per measure
- [x] #10 The client's What moved block still renders as PlannedFeatureBlock (comparison-page.tsx, pinned by comparison-page.test.tsx); this card ships no UI change
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
6. The two threshold rules, settled 2026-09-08. Both take the structural
answer over a synthesized statistic, for the reason already on this card:
a large-sample multiplier at these rep counts asserts precision the data
does not carry.

"inside rerun noise" is structural range overlap. Two arms read as inside
rerun noise when their observed ranges share any point: the low-to-high
grade span from gradeDistribution for a graded measure, the
successful-of-requested count for a binary one. No Wald interval, no
confidence level, no tunable z. This matches the design's own wording,
"arms overlap by 2 steps", which describes observed spans touching rather
than intervals intersecting. The recorded standardError
(confirmation-report.ts:83) stays unused by this rule.

"unchanged, already clear" is the exact ceiling, kept as its own category
rather than folded into overlap, because the design names it separately and
it says something different: not that the two arms are indistinguishable,
but that both already succeed every time and there is no room above.

Note for the builder: the ceiling for a graded stage measure is not all-A,
and it is not the configured minimum grade either. stageObservation
(confirmation-report.ts:99-105) hardcodes grade === "A" || grade === "B" and
never reads DEFAULT_MINIMUM_STAGE_GRADE, so a rep counts as successful at A or
B whatever a case configures. The ceiling test is successful === requested in
both arms, which reads off the recorded counts and stays correct without
restating that rule. Corrected 2026-09-08: an earlier note here claimed the
success threshold follows the configured minimum. It does not, at this call
site.

7. Row set and axes, corrected 2026-09-08 after reading the record. Decisions
1 and 6 above named a "binary measures" row and a "meter" row. Neither exists.
buildQualityContrast produces one row per declared stage plus, in pipeline
mode, "final" (comparison-quality.ts:132-135), and nothing else.
comparison-resources.ts computes cost, token and turn distributions per role,
not a user-declared meter measure. So this card implements the reading only
for the rows that exist, and a binary or meter reading is filed separately
once such a measure exists. This is the same split that already deferred
"fires less often" and "clearest movement".

Correction to decision 6: the two existing row kinds do not share one axis.
A declared-stage row's gradeDistribution is over the five letters. The
"final" row's is over PASS and FAIL, because finalObservation records
grade: outcome.verdict (confirmation-report.ts:123), the verdict string
itself, never a letter. The overlap and ceiling readings keep their names on
both, but the final row is a two-value axis and its overlap is not the
five-point span math. Write it as its own rule rather than a special case of
the letter scale.

8. Where the reading attaches. A new field on qualityContrastSchema
(comparison-record.ts) beside successRate and passK, carrying the interval and
the verdict, computed in buildQualityContrast from the two arms'
ReliabilitySummary already in scope at comparison-quality.ts:91-98. Today that
function narrows each summary to a bare successRate and passK before calling
buildPairedEstimate, so the fuller summary has to be kept rather than
discarded. The reading is computed from those summaries and not from the
paired estimate, per decision 1.

9. The third verdict, settled 2026-09-08. Decisions 4 and 7 left a hole: they
gave the magnitude label to meter rows, then removed meter rows, so a graded
row whose arms neither overlap nor both sit at ceiling had no verdict. That
case is the common one, a candidate that is clearly better but not perfect,
and rendering no phrase there would stay silent exactly where the row has
something to say.

The closed set is therefore three: inside rerun noise, unchanged already
clear, and a directional reading for separated arms, naming which arm
succeeds more often. The direction comes from comparing the two arms'
recorded successful-of-requested counts, the same structural comparison the
other two rules use. No synthesized statistic, on either axis.

Shaping pass, 2026-09-08. Adversarial review (unprimed reviewer, reading only
this card and the cited source files) caught three defects in an earlier draft
of this pass and they are fixed in what is now on the card:

- The first draft of this shaping pass overwrote the nine decisions above with
  a compressed summary, editing the notes section wholesale instead of
  appending. Restored verbatim; nothing above this paragraph was written by
  this pass.
- AC #4 originally said the ceiling test holds "at or above the configured
  minimum grade." False as written: stageObservation
  (confirmation-report.ts:101-104) hardcodes `outcome.grade === "A" ||
  outcome.grade === "B"`, and buildReliabilityReport is never passed a
  minimum-grade argument, so no case-configured minimum reaches
  ReliabilitySummary.successful today. Decision 6's own builder note made the
  same claim; it is equally unsupported by this file and should be read as
  aspirational, not current behavior. AC #4 now cites the actual hardcoded
  A-or-B check instead.
- AC #8 first placed the new field directly on qualityContrastSchema
  (comparison-record.ts), computed inside buildQualityContrast
  (comparison-quality.ts), which runs at compare-time inside
  buildComparisonReport (comparison-report.ts:84, called from
  comparison-command.ts:73) — persist time, not serve time. That contradicts
  decision 2, which this pass had just restored, and which places the field at
  serve time by the same route src/server/comparisons.ts uses for attribution.
  That route works for attribution because its raw input, executedCorpus, is
  itself already a persisted field (comparison-record.ts:234) that the server
  re-derives a presentation value from on each request. ReliabilitySummary
  (gradeDistribution, successful, requested) is not persisted anywhere today;
  only the narrowed successRate/passK survive onto qualityContrastSchema. So
  decision 2's serve-time route is not available for this field without first
  persisting the fuller ReliabilitySummary per arm, which is itself a schema
  change decision 2 said this card does not need.

OPEN QUESTION for whoever builds this, unresolved by anything on the card:
where does the interval/verdict field actually get computed and stored?
Two ways forward, neither cheaper by inspection:
(a) persist ReliabilitySummary (or just gradeDistribution) per arm per
measure onto qualityContrastSchema, alongside successRate and passK, and
compute the interval/verdict at serve time from that stored data, matching
decision 2's server-owned-contract reasoning but adding a stored field
decision 2 said wasn't needed; or
(b) compute the interval/verdict at compare-time inside buildQualityContrast,
same place successRate/passK are already computed, and persist the result
directly, abandoning decision 2's serve-time placement but adding no new
raw-data field, only the computed one AC #8/#9 already describe.
(b) is the smaller change and matches where every other field on
QualityContrastEstimate is already computed, but it means decision 2 as
written is wrong and should be corrected rather than followed. Recommend (b),
with decision 2 struck and replaced, but this is a reversal of a decision the
card twice called settled, so it goes back as a question rather than being
decided a third time in this pass.

First test to write once the open question is answered: a
comparison-quality.test.ts case with two arms whose gradeDistribution spans
touch (e.g. one arm all B, one arm mixed B/C) asserting verdict "inside rerun
noise"; then the ceiling case (both arms successful === requested under the
hardcoded A/B check); then a separated case asserting the directional verdict
names the higher-successful arm; then the 0/n and n/n edge cases; then a
"final" row PASS/FAIL case for each of the three rules.
10. Decision 2 stands, 2026-09-08. A shaping pass proposed striking it and
computing the reading at compare time, on the grounds that the reliability
data the reading needs is not persisted and so cannot be reached at serve
time. That premise is false, checked in the schema: each arm persists its
whole array of reliability summaries at comparison-record.ts:235, beside the
executedCorpus field that attribution already derives from at serve time, and
reliabilitySummarySchema (:148-163) carries gradeDistribution, successful and
requested, which is every input the overlap, ceiling and direction rules take.

So the reading is derived at serve time from the record, as decision 2 says,
and no new persisted field is added. Do not reopen this a third time without
first checking that schema.

Shaping pass, 2026-09-08 (second pass). Verified every load-bearing fact
decisions 1-10 rest on, directly against source, rather than trusting the
prior pass's citations:

- reliabilitySummarySchema (comparison-record.ts:148-163) carries
  gradeDistribution, successful, requested, exactly as decision 10 says, and
  IS persisted per case per arm at reportArmSchema.quality
  (comparison-record.ts:235). Decision 10's reversal of the "reopen decision
  2" proposal holds: serve-time computation from the record is available,
  no new persisted field needed.
- STAGE_LETTER_GRADES = ["A","B","C","D","F"] (config.ts:18) is the ordered
  scale decision 1's low/high span reads off.
- stageObservation's hardcoded A-or-B success check (confirmation-report.ts:
  93-99) matches AC #4 as corrected in the prior pass; DEFAULT_MINIMUM_STAGE_
  GRADE (config.ts:22) does not reach this function today, confirmed by
  reading buildReliabilityReport's call sites.
- finalObservation (confirmation-report.ts:112-119) stores grade: outcome.
  verdict, a "PASS"|"FAIL" string, never a letter, confirming decision 7's
  correction that the final row is a two-value axis needing its own rule,
  not a special case of the five-letter scale.

Remaining gap the nine decisions did not name: where in src/server/ the new
serve-time derivation lives and what shape it walks. Checked and answered
from precedent, not left open:

reportContrast.quality (comparison-record.ts:296, qualityContrastSchema) is
the cross-case-paired estimate (name, successRate, passK) already computed
at compare time by buildQualityContrast. reportCase.arms[arm].quality
(comparison-record.ts:235) is the per-case, per-arm ReliabilitySummary[]
decision 10 points to, keyed by stage/measure name via the same lookup
buildQualityContrast's qualitySummary helper already does
(comparison-quality.ts:64-72). These are two different arrays on two
different schema nodes; the new field reads the case-level one and attaches
per (case, measure), per decision 9, so it cannot live merely beside
successRate/passK on qualityContrastSchema (that node is already pooled
across cases) — it needs a per-case carrier, e.g. a map or array keyed by
caseId, alongside reportContrast.quality, or nested under reportCase itself
read against both arms of the given contrast.

Precedent for the whole shape: src/server/comparisons.ts's comparisonReport
function already does exactly this loop today for attribution, walking
report.cases[...] and, per case, per arm pair (armPairs()/pairKey()), reading
each arm's executedCorpus and deriving a value the client wasn't sent
pre-computed. The new function is a sibling to comparisonAttribution
(src/server/comparison-attribution.ts): same iteration shape (per case, per
arm pair, per named measure this time), same file organization (its own
module, wired into comparisonReport's return value next to attribution),
same reasoning for serve-time placement. No new numbered decision needed;
this is convention already established in the file the card's own decision
2 cites.

Card is build-ready. No unknowns remain open. First test to write is
unchanged from the prior pass's note: a comparison-quality.test.ts (or a new
server-side test beside comparison-attribution.test.ts, matching wherever
the new function lands) case with two arms whose gradeDistribution spans
touch, asserting "inside rerun noise"; then ceiling; then the directional
case; then 0/n and n/n edges; then the "final" row PASS/FAIL case for each
rule.
11. AC #8's parenthetical open question is closed by decision 10 above. The
interval and verdict are derived at serve time from the persisted record. No
new persisted field, no schema version bump.

Build complete, 2026-09-08. Four commits: qualityReading (comparison-quality-reading.ts, pure function), its serve-time wiring into comparisonReport (comparisons.ts, mirroring comparisonAttribution), a find-by-name lookup extraction (reliabilitySummaryNamed, confirmation-report.ts), and a fix commit for two correctness bugs the review round found (see below).

Six-axis independent code review ran (Spec, Style, Architecture, Security, Testing, Refactoring-advisory). Spec: all 10 ACs present with code path and test. Security: no findings, the new field only summarizes data already unredacted in the same response. Two should-fix [correctness] findings, confirmed independently by both Style and Architecture axes with matching evidence, both fixed and covered by new tests before this card closed:
  1. higherSucceedingArm named the subtrahend arm as "succeeding more often" on an exact tie (equal successful/requested rate, non-overlapping grade spans) instead of reporting no direction. Now returns undefined on a tie; verdictFor routes that to insideRerunNoise.
  2. spanOf threw when an arm's gradeDistribution was empty, which every declared stage after an earlier STOP verdict produces (a normal NOT_REACHED outcome, not a malformed input). Previously this throw only ran at persist time, on a path that never needed a grade span; wiring qualityReading into the live GET /api/comparisons/:digest handler made it newly reachable, turning a routine early-stop pipeline into an uncaught 500 for the whole comparison report. Fixed: spanOf returns undefined; QualityInterval per arm is now optional; an undefined span is treated as overlapping (no evidence to separate on), which also resolves to insideRerunNoise.
Also fixed from the same review round: comparisonReport's per-pair body extracted to qualityReadingsByMeasure (Refactoring axis, capped the loop nesting at two visible levels); its docstring now names qualityReadings' rationale, not only attribution's (Style, note); comparisons.test.ts gained a test asserting every declared-stage measure and the pipeline-mode final row render through the real server wiring (Testing, two should-fix — the prior test's name overclaimed coverage of "build" and "final" it never asserted).

What changed: served comparison report now carries qualityReadings[caseId][armPairKey][measureName], each a { interval: { minuend, subtrahend }, verdict } computed at serve time from the persisted per-case ReliabilitySummary[] already on the record. No schema change, no persisted field added.

What isn't wired up: the client's What moved block (comparison-page.tsx) still renders PlannedFeatureBlock, unchanged, per AC #10 and the card's own decision 5. Whoever picks up that screen card can now build the interval/verdict UI directly off GET /api/comparisons/:digest's new qualityReadings field; the planned-block copy claiming a paired estimate can't supply the interval is now false and should be corrected when that card starts.

What I did not verify: the "unreached measure" case (empty gradeDistribution, now returning insideRerunNoise with undefined intervals) is unit-tested but not exercised through the live server wiring, since no fixture in this repo currently produces a persisted record with an all-NOT_REACHED stage for one arm. If that shape turns up in a real recorded comparison, confirm the served response degrades to undefined intervals rather than 500ing, the same way the unit tests predict.

Verified this session: full suite green (1277 pass / 0 fail root, 100 pass / 0 fail client), typecheck clean, lint clean on every touched file, oxfmt clean. All fixes observed via fresh test runs, not asserted from memory.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Served comparison report now carries a per-measure, per-case, per-arm-pair quality reading (grade-span interval plus a closed-set verdict: inside rerun noise, unchanged already clear, or separated naming the stronger arm), computed at serve time from already-persisted reliability data. No schema change. Client's What moved block intentionally untouched (AC #10).

Independent six-axis review found and this session fixed two real correctness bugs before closing: a tie-break defect that misattributed direction on equal success rates, and a throw that turned a routine early-stopped pipeline outcome into a server 500. Full suite green, all 10 acceptance criteria checked with code path and test evidence on the card.
<!-- SECTION:FINAL_SUMMARY:END -->
