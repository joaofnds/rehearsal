---
id: ACT-69
title: 'run a full compare across two cases and three arms, with a set budget'
status: To Do
assignee: []
created_date: '2026-09-04 23:30'
updated_date: '2026-09-09 15:20'
labels: []
dependencies:
  - ACT-140
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

Triage verdict, 2026-09-09 (doc-56). Disposition: deferred, blocked outside this session. Left unprioritized deliberately.

AC#4 requires the provider spend recorded against a budget set before the run starts, and no spending authority for a full compare is recorded anywhere on this board. That number is Joao's to give and no session can invent it. It is the one card here excluded from the queue for a reason a session cannot route around, rather than for timing.

What would unblock it: a typed budget figure for a two-case, three-arm, two-rep compare. Everything else the card names is buildable today.

Overseeing finding, 2026-09-09: the 'blocked on a second benchmark case' premise is wrong, and it changes this card's price by roughly 4x.

The report schema constrains counts, not case kinds: comparison-record.ts requires cases min 2, reps min 2, and three arms per case, and nothing there or in comparison-loader.ts requires a pipeline case. The report's mode field imports confirmationModeSchema from confirmation-record.ts, whose enum is ['stage','pipeline','session'], so 'session' is a valid comparison mode, with a session case's checks as its one stage (covered by confirmation-record.test.ts, 'accepts a session group at schema version 1, with checks as its one stage').

cases/ already holds ten session cases (four brief-reply, four doctrine, manifest-probe, smoke) beside the one pipeline case. So a two-case comparison is assemblable today from session cases, and the second pipeline case this card called a blocker is only needed for a pipeline-mode comparison.

Pricing from 72 recorded costUsd values across .benchmark-runs, totalling 83.02 USD: median 0.739, p90 1.704, max 8.686. Session-case runs median 0.818. The audit-log pipeline stages are the expensive tail: one build stage cost 8.686.

At 2 cases x 3 arms x 2 reps = 12 runs: session-mode expects about 9.82 and runs about 20.45 if every run lands at p90. Pipeline-mode expects about 41.40 and about 104.23 at the p90 tail.

The old scale figure on this card, 0.43 to 0.53 USD, came from two failed shape attempts, which are the cheapest runs on record and understate a completed run.

Budget authorized 2026-09-09 by João, typed into the iterate session: 25 USD, session mode, for a two-case three-arm two-rep compare. Pipeline mode is deferred until the comparison path has run once cheaply.

This is the budget AC#4 requires to be set before the run, and it is set before any spend on this card. Expected spend is about 10 USD at the recorded median and about 20 USD if every one of the twelve runs lands at the p90 of recorded costs, so 25 covers the pessimistic case with margin. Stop the run and report rather than exceeding it.

The second pipeline case is no longer a blocker, per the pricing note above: the comparison is assembled from the session cases already in cases/.

Stop before spending, 2026-09-09. The authorized session-mode compare cannot run: session confirmation groups are not built.

Verified directly this session, at no cost. 'rehearsal run --case smoke --model sonnet --confirm --reps 2 --yes' prints 'Projected maximum cost: $0.40 (2 reps x $0.20)' and then 'A session confirmation group is not built yet; run the case without --confirm', exiting without a provider call. The refusal is deliberate: run-command.ts line 392 documents that the projection is shown and the group refused before any provider call, so the ordering holds whether or not the group exists.

So the earlier pricing note was right that the report schema accepts session mode, and wrong about what the harness can produce today. The schema would take it; the runner cannot build it. That is the correction: the blocker was never a second pipeline case, and it is not the schema either, it is the unbuilt session confirmation path.

Pipeline and replay confirmation groups are built (runPipelineConfirmation, runReplayConfirmation). 'rehearsal list groups' and 'list comparisons' are both empty, so no confirmation evidence exists yet in any mode, and 'compare' runs no session of its own: it reports over evidence that a prior --confirm run produced.

The 25 USD authorization stands unspent and is recorded above. Two routes, neither taken without a typed direction: build the session confirmation path first, then spend the 25 in the authorized mode; or spend it in pipeline mode, which the earlier note priced at about 41 USD expected and about 104 USD at the p90 tail for 2 cases x 3 arms x 2 reps, so 25 does not cover a full pipeline compare and the shape would have to shrink.
<!-- SECTION:NOTES:END -->
