---
id: ACT-140
title: build the session confirmation group path
status: Shape
assignee: []
created_date: '2026-09-09 15:20'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-7
dependencies: []
references:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
documentation:
  - backlog/docs/doc-61 - Triage-rehearsal-backlog.md
priority: high
type: feature
ordinal: 136008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run existing session cases as isolated repetitions from one captured input set, preserving every successful and failed attempt in a readable confirmation group. Cost projection and approval precede provider calls. Resolve the session frozen-input representation during shaping; do not record an invented pipeline. The present runConfirmed hook deliberately refuses and the installed CLI environment cannot find claude. ACT-69 owns the existing USD 25 comparison budget; this implementation has no separately recorded provider-spend allowance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rehearsal run on a session case with --confirm --reps N executes N reps and writes a confirmation group record, instead of refusing with 'A session confirmation group is not built yet' (observed 2026-09-09: 'run --case smoke --model sonnet --confirm --reps 2 --yes' printed the projection then refused, exiting without a provider call)
- [ ] #2 rehearsal list groups returns the written group and rehearsal show on its id prints the record (observed 2026-09-09: list groups is empty and no command produces a session group)
- [ ] #3 The projected cost is shown and approved before any provider call (executeSessionRun and runRequestedExecution ordering; ACT-140 original AC3)
- [ ] #4 Each repetition runs in its own attempt directory from the group’s frozen shared inputs (João’s approved session benchmark scope, doc-59)
- [ ] #5 If one repetition fails, peer repetitions complete and the group records the failed repetition rather than silently dropping it (João’s approved session benchmark scope, doc-59)
- [ ] #6 Each repetition’s named check results remain available through its recorded attempt evidence (João’s approved session benchmark scope, doc-59)
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

Approved session benchmark scope, 2026-09-09 (doc-59): reuse this existing card for confirmation execution. ACT-143 adds frozen skill delivery; ACT-144 adds generated fixture inputs; ACT-145 adds preserved state and named grading results; ACT-146 owns session comparison, single-case statistics and partial-score reporting; ACT-147 owns regrading. This card can deliver repetitions of existing session cases without waiting for all those capabilities.

Extend the runner's acceptance to isolated repetitions from one frozen set of shared inputs, peer failure records and group accounting. Preserve the actual named check results through the attempt evidence referenced by each rep, even if the current compatibility summary maps them to A/F. Let ACT-146 consume that evidence rather than reconstructing individual checks from the aggregate letter. The frozen-input schema's pipelinePath placeholder remains a design question: represent actual session input evidence instead of recording a fabricated pipeline as if it ran. ACT-146 also needs a session-specific quality path; a schema accepting mode session does not make comparison-quality support it.

First new verification target: one rep fails while its peers complete, with all repetitions starting from the same frozen shared inputs. No new provider spend was authorized or incurred in this card-filing session.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: high. Confirmation execution blocks the authorized two-case comparison; without it no session group exists to compare.

Evidence: executeSessionRun rejects runConfirmed. Confirmation records accept session checks but frozenInputsSchema requires pipelinePath; the representation must be resolved before implementation. 143 focused tests pass. The normal smoke command stops earlier because claude is missing from PATH.

Unresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.

Next action: Shape the session-specific frozen-input record and map isolated attempts into runConfirmation. Bound this to one shaping session without provider spend. Build can use injected runners; real smoke evidence waits for the executable.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
