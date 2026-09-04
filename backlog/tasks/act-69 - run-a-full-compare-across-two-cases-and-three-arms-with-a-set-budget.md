---
id: ACT-69
title: 'run a full compare across two cases and three arms, with a set budget'
status: To Do
assignee: []
created_date: '2026-09-04 23:30'
updated_date: '2026-09-04 23:37'
labels: []
dependencies: []
type: feature
ordinal: 65008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split off ACT-39 on 2026-09-05. ACT-39 pictured `compare` producing a report over two replay attempts. The report schema cannot express that: src/benchmark/comparison-record.ts requires cases min 2 (line 311), reps min 2 (line 310), and caseDeltas min 2 (line 170), and comparison-loader.ts (lines 314-326) loads three arms per case with control mandatory.

So the full comparison path needs a second benchmark case and real confirmation groups, 2 cases x 3 arms x at least 2 reps of provider spend. That is money this card exists to weigh separately, and the budget is set before the run, not after.

For scale: two single failed shape attempts on the audit-log case cost 0.4304 and 0.5278 USD.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison manifest declares at least two benchmark cases, each with baseline, candidate, and control arms
- [ ] #2 Each arm runs as a confirmation group of at least two reps
- [ ] #3 `rehearsal compare` emits a report record over that manifest and its path is recorded on this card
- [ ] #4 The provider spend for the whole run is recorded on this card against the budget set before it started
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created by the iterate session that shaped ACT-39, at João's direction to split the compare work onto its own budgeted card.

Blocked on a second benchmark case, noted 2026-09-05. cases/ holds one pipeline case (audit-log); the rest are session cases. The report schema requires cases min 2, so a second pipeline case has to exist before a comparison can be assembled.

Budget is unset and this is the board's largest provider spend: 2 cases x 3 arms x at least 2 reps. For scale, one single failed shape attempt on audit-log cost 0.43 to 0.53 USD. Do not start this card without a number from João.
<!-- SECTION:NOTES:END -->
