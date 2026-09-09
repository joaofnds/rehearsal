---
id: ACT-140
title: build the session confirmation group path
status: To Do
assignee: []
created_date: '2026-09-09 15:20'
updated_date: '2026-09-09 15:20'
labels: []
dependencies: []
priority: high
type: feature
ordinal: 136008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rehearsal run on a session case with --confirm --reps N executes N reps and writes a confirmation group record, instead of refusing with 'A session confirmation group is not built yet' (observed 2026-09-09: 'run --case smoke --model sonnet --confirm --reps 2 --yes' printed the projection then refused, exiting without a provider call)
- [ ] #2 rehearsal list groups returns the written group and rehearsal show on its id prints the record (observed 2026-09-09: list groups is empty and no command produces a session group)
- [ ] #3 the projected cost is shown and approved before any provider call, as it is today (run-command.ts line 392 records that ordering as deliberate)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed 2026-09-09 by the iterate session, blocking ACT-69.

ACT-69's compare was authorized at 25 USD in session mode on the finding that the comparison report schema accepts mode 'session' (confirmationModeSchema is ['stage','pipeline','session'], and cases/ holds ten session cases). The schema does accept it. The runner cannot produce it, which is what this card builds.

executeSessionRun in src/cli/run-command.ts projects the cost and then refuses at line 432. The comment at line 392 states the intent: the projection is shown and the group refused before any provider call, so the cost-approval ordering holds whether or not the group exists. Keep that ordering, which is why it is AC#3.

The built siblings to follow are runPipelineConfirmation in src/benchmark/pipeline-confirmation.ts and runReplayConfirmation in src/benchmark/replay-confirmation.ts. confirmation-record.ts already parses a session group: see confirmation-record.test.ts, 'accepts a session group at schema version 1, with checks as its one stage'. So the record shape exists and this card wires the runner to it.

Cost of this card is its own reps, not ACT-69's compare. A session rep on the smoke case projects at 0.20 USD.
<!-- SECTION:NOTES:END -->
