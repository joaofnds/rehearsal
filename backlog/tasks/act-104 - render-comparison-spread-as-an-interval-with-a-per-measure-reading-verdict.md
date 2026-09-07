---
id: ACT-104
title: render comparison spread as an interval with a per-measure reading verdict
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-07 23:07'
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
Ambiguity found 2026-09-07, verified in code before this card is picked up. This card's interval is described as 'a spread across attempts', matching SPEC.md 5b's column heading 'Spread across 6 attempts'. The quantity the harness actually computes is not that: buildPairedEstimate (src/benchmark/comparison-estimator.ts:57) derives standardError across CASES, dividing sampleVariance by caseDeltas.length, and it throws below two cases. An interval drawn from it is a spread across cases, not across the attempts within an arm.

Whoever builds this card settles which quantity the interval represents before drawing it, since the two answers differ numerically and the screen asserts a claim about rerun noise either way.

Separately: a 95% interval as meanDelta +/- 1.96*standardError is a routine default, since docs/research.md adopts that error-bar framing and both terms already exist. The per-measure reading verdict is not. Three of SPEC 5b's five phrases ('clearest movement', 'unchanged, already clear', 'fires less often') cannot be derived from a single PairedEstimate under any threshold: 'clearest movement' ranks measures against each other, and blocker rows are counted rather than graded. Designing that vocabulary is the substance of AC #2.
<!-- SECTION:NOTES:END -->
