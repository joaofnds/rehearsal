---
id: ACT-127
title: 'kaizen: a card''s record states a fact that inspection contradicts'
status: To Do
assignee: []
created_date: '2026-09-08 21:49'
updated_date: '2026-09-09 16:21'
labels: []
dependencies: []
references:
  - >-
    backlog/decisions/decision-7 -
    Start-the-kaizen-on-records-stating-facts-inspection-contradicts.md
priority: medium
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Seventh instance, found by triage 2026-09-09, same pattern and worth adding to the six the card already holds.

ACT-126's description states: 'ACT-50 is not the right home: it is Done and its own text deliberately deferred this tab to ACT-104 by name.' ACT-50 reads To Do, verified this run. Commit f835f75 reopened it and added AC#13 for exactly the tab ACT-126 covers, two hours after ACT-126 was filed.

What makes it the same pattern rather than ordinary staleness: the claim was checkable when written (the card asserts another card's status without reading it), and the assertion is load-bearing, since it is the whole reason the card exists as a separate card instead of a criterion on ACT-50. This one differs from the earlier six in one way worth the kaizen's attention: the fact was true when written and was falsified two hours later by a direction. A guard that only checks at write time would have passed it. That argues for the check living where a card is next read, not only where it is written.

Also recorded as a consequence on decision-7.

Cross-board wait: implementation belongs to /Users/joaofnds/code/dotfiles. Reconsider when an owning-session result is available or that repository is explicitly in scope. This triage makes no reciprocal board edits.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: medium. Repeated false card facts distort planning; prose now asks for checks but no observed guard meets AC2.

Evidence: Seven accepted instances are recorded; current triage SKILL requires source checks, while no automated/observed precommit guard was found.

Unresolved claims/resources: None for the next action. Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal.

Next action: Run kaizen on the recorded instances and define an observable guard at claim write/read time.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
