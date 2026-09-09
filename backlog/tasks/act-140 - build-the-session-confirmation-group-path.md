---
id: ACT-140
title: build the session confirmation group path
status: To Do
assignee: []
created_date: '2026-09-09 15:20'
updated_date: '2026-09-09 15:22'
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

Design read, 2026-09-09, by the overseeing iterate session. Handed off unbuilt so a fresh session can build it without another session running in the same tree. Every claim below was read at the source this session.

The seam is one hook. executeSessionRun in src/cli/run-command.ts (around line 396) already wires runRequestedExecution with projectCost, approval, and runDebug working; only runConfirmed rejects, at line 432. Fill that hook and the command works. Do not touch the projection or approval ordering: the comment at line 392 records it as deliberate, which is AC#3.

The rep contract is already specified by tests, so follow them rather than inventing it. confirmation-record.test.ts 'accepts a session rep at schema version 1, with its checks as one stage' fixes the mapping: one stage entry named 'checks', status JUDGED, verdict CONTINUE and grade A when the checks pass, verdict STOP and grade F when they fail (its sibling test 'refuses a session rep called successful when its checks failed' enforces that), finalOutcome { status: 'NOT_APPLICABLE' }, and worktreePath set to the attempt directory rather than a real worktree. The group contract is 'accepts a session group at schema version 1, with checks as its one stage': mode 'session', declaredStages ['checks'].

Two schema constraints to plan for. confirmationRepRecordSchema requires workerTrajectorySteps to equal the provider-reported worker turns, and requires repId to equal '<groupId>-rep-<ordinal>'; runConfirmation in src/benchmark/confirmation.ts already generates that id shape, so reuse it rather than formatting the id again. frozenInputsSchema requires pipelinePath as a non-empty string, which a session case has no equivalent for. The existing test fixture uses 'pipelines/default.json'. Decide what a session group puts there and record the decision on this card; that is the one open modeling question in this build.

What to reuse rather than rebuild. runConfirmation (confirmation.ts line 155) is generic over inputs and result and already plans the reps and their ids. runSessionDebugAttempt (src/cli/session-run-command.ts line 225) is the single rep's work: it resolves the corpus, computes lineage, runs the attempt, and writes the attempt record. A rep is that attempt against inputs frozen once for the group. projectConfirmationCost already handles mode 'session' at one session per rep, verified by running the command.

What NOT to copy. runPipelineConfirmation and runReplayConfirmation both create git worktrees and materialize checkpoints because they run code stages against a target. A session case declares neither a target nor a pipeline, so it needs no worktree and no checkpoint materialization. Following those two siblings literally is the main way to overbuild this card.

Verification available at no provider cost: 'mise exec -- ./rehearsal.ts run --case smoke --model sonnet --confirm --reps 2 --yes' currently prints 'Projected maximum cost: $0.40 (2 reps x $0.20)' then refuses. That command is AC#1's probe. 'rehearsal list groups' is empty today, which is AC#2's starting state.

Budget note: this card's own spend is its reps, at about 0.20 USD per rep on the smoke case. It is not ACT-69's 25 USD, which stays unspent for the compare after this lands.
<!-- SECTION:NOTES:END -->
