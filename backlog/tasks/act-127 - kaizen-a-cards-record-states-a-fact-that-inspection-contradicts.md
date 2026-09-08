---
id: ACT-127
title: 'kaizen: a card''s record states a fact that inspection contradicts'
status: To Do
assignee: []
created_date: '2026-09-08 21:49'
labels: []
dependencies: []
ordinal: 123008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Greenlit by direction 2026-09-08 ("Agree with both"), after doc-43 recommended starting it rather than carrying it to a fifth run. It has been carried since doc-33.

The pattern, five independent instances across five sessions and three kinds of work: a card's own record states a fact about another card, or about itself, that direct inspection contradicts, and nothing prompted the checkable verification before it was written down. Named at doc-28 (ACT-86), doc-32 (ACT-48), doc-33/36/38, and doc-42 (ACT-51's final summary asserted ACT-26.7's closure without reading ACT-26.7's acceptance criteria).

A sixth instance was observed this session, on ACT-104: a design note stated that a rep counts as successful at the run's configured minimum grade. stageObservation (src/benchmark/confirmation-report.ts) hardcodes grade A or B and never reads DEFAULT_MINIMUM_STAGE_GRADE. The claim was inferred from the constant existing rather than from the call site, and it sat on the card for three commits before review caught it.

The corpus's Claims rule already forbids exactly this, so the gap is procedural, not doctrinal: nothing in the flow forces the check at the moment the claim is written. The fix should be a system guard rather than more vigilance, since every one of these sessions believed its claim was true.

Run the kaizen skill against the six instances to find where the guard belongs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The kaizen names the point in the flow where a cross-card or cross-code claim gets written without a check, backed by the six recorded instances
- [ ] #2 A guard exists that fires on such a claim before it is committed, observed by writing one and seeing it caught
<!-- AC:END -->
