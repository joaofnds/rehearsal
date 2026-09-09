---
id: ACT-140
title: build the session confirmation group path
status: Build
assignee: []
created_date: '2026-09-09 15:20'
updated_date: '2026-09-09 21:37'
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
Run existing session cases as isolated repetitions from one captured input set, preserving every successful and failed attempt in a readable confirmation group. Cost projection and approval must precede every provider call, including the model preflight. Resolve the session frozen-input representation during shaping; do not record an invented pipeline. The current runSessionCase probes the model before executeSessionRun projects cost and refuses confirmation. Claude is installed at /opt/homebrew/bin/claude; this invocation PATH omits its directory. ACT-69 owns the existing USD 25 comparison budget; this implementation has no separately recorded provider-spend allowance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rehearsal run on a session case with --confirm --reps N executes N reps and writes a confirmation group record instead of refusing confirmation (ACT-140 original AC1; doc-69 provider-free runRunCommand/executeSessionRun probe confirms the current refusal; the prior no-provider-call CLI claim is contradicted by the model preflight ordering)
- [ ] #2 rehearsal list groups returns the written group and rehearsal show on its id prints the record (observed 2026-09-09: list groups is empty and no command produces a session group)
- [ ] #3 The projected cost is shown and approved before any provider call, including the CLI model preflight (ACT-140 original AC3; doc-69 injected outer-CLI probe shows runSessionCase currently probes the model before executeSessionRun projects cost)
- [ ] #4 Each repetition runs in its own attempt directory from the group’s frozen shared inputs (João’s approved session benchmark scope, doc-59)
- [ ] #5 If one repetition fails, peer repetitions complete and the group records the failed repetition rather than silently dropping it (João’s approved session benchmark scope, doc-59)
- [ ] #6 Each repetition’s named check results remain available through its recorded attempt evidence (João’s approved session benchmark scope, doc-59)
- [ ] #7 A session confirmation whose declared corpus input cannot yet be isolated is refused before the model preflight or any rep, naming ACT-143 rather than reading mutable live bytes (doc-59 split scope; session-corpus.ts current delivery boundary)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: a confirmed session run pays only after its projected cost is approved,
then records every requested isolated rep against one group-owned frozen input
set, including unsuccessful and execution-failed reps.

### Chosen boundary

Add `src/benchmark/session-confirmation.ts` as the adapter between a session
case and the existing confirmation machinery. It freezes the session inputs
once, calls generic `runConfirmation` for IDs, ordinals, shared-input identity
and peer completion, maps each outcome to a session confirmation rep, writes
each `rep.json`, then uses the shared group finalizer to read those reps and
write `report.json` and `group.json`. If any rep record cannot be written, the
adapter propagates that infrastructure failure and does not finalize a group.
It does not create Git worktrees, checkpoints, Product Owners, or Judges.

Split the reusable single-attempt work in `src/cli/session-run-command.ts` so a
caller can execute and record an attempt from already-resolved inputs in a
caller-selected record directory. The debug path keeps its current random
session-attempt layout; the confirmation path gives each rep its own execution
directory and writes its full `attempt.json` plus transcript under that rep's
record directory. The rep record points to `attempt.json`, which remains the
source for every named check result.

### Frozen session record

Preserve the current v1 parser branch byte-for-byte, including its provisional
session fixture, so every previously valid v1 record stays readable. Add a v2
session branch selected by `schemaVersion: 2` and `mode: "session"`; new session
groups and reps use that branch, while stage and pipeline writers stay on v1.
The v2 session branch records only session facts:

- `inputs.lineage` is `{ kind: "SESSION", lineage: <session lineage> }`, shared
  by the group and every rep;
- `inputs.files` adds honest `case`, `fixture`, `transcript`, and `corpus`
  kinds and hashes the normalized loaded case declaration plus every present
  fixture, transcript-prefix, and declared corpus file under the group's
  `inputs/` directory;
- `inputs` retains the workflow model, optional effort, and session budget, and
  has no `pipelinePath`, `judgeModel`, or `judgeEffort`;
- the one rep stage is `checks`; checked attempts map pass to A/CONTINUE and
  fail to F/STOP, `NO_REPLY` maps to NOT_REACHED, and invocation failures map
  to EXECUTION_FAILED;
- session check evidence is `{ recordFile: "attempt.json" }`, not a fabricated
  Git `resultSha`; `finalOutcome` is NOT_APPLICABLE;
- the sole provider metrics call has role `worker`; missing metrics make the
  rep unsuccessful and retain the reason under the existing missing-metrics
  representation. `workerTrajectorySteps` is that call's reported turns.

The model preflight is paid work with its own `$0.10` ceiling, not a free gate.
Expose that ceiling from `src/benchmark/preflight.ts` as the one value both the
probe and projection consume. A v2 session projected cost records
`preflightMaximumUsd`, and `totalMaximumUsd` is that fixed overhead plus
`reps * perRepMaximumUsd`; the two-rep smoke approval therefore shows `$0.50`,
not `$0.40`. Record the successful preflight as group-level provider evidence
with complete metrics or an explicit missing-metrics status. Rep resource
distributions remain per-rep; the group summary adds the one preflight call so
its actual total covers the whole confirmed command. If the preflight metrics
are missing, the summary prints that actual total cost is unavailable; it must
not print a numeric rep-only total as the command's cost.

Capture the normalized case declaration, fixture tree, transcript prefix, and
declared corpus bytes before launching any rep. Build the in-memory frozen
`SessionCase` with paths into that group-owned copy, compute its lineage once,
and pass the same frozen value to every plan. Source mutation after capture
must therefore be invisible to all reps. Keep the current session-corpus
delivery boundary: ACT-143 still owns delivery of skills and global inputs the
current overlay cannot isolate, so confirmation refuses those unsupported
inputs before model preflight rather than reading mutable live bytes or
claiming they were frozen. On 2026-09-09,
`rg -l '"CLAUDE.md"|"skills/' cases/*/case.json` names the five current cases
in that deferred subset; the other five session cases use inputs the current
overlay can isolate.

### Execution and failure ordering

Call `refuseWithoutTerminal` on the session route after parsing and spend-
authorization, matching the pipeline route: a noninteractive confirmation
without `--yes` refuses before projection, model probe, or execution. Move the
injected model probe across the session execution boundary. Both the debug and
confirmed callbacks probe immediately before their first attempt, inside
`runRequestedExecution`; for confirmation this places projection and approval
before the probe. There is exactly one model probe per accepted command.

Separate provider execution failure from harness failure around both the
`runClaude` call and valid envelope interpretation. A rejected command and a
parsed provider envelope with `is_error: true` become a typed
`SessionInvocationError`; malformed JSON, an envelope that fails its schema,
and failures after valid-envelope classification remain harness failures. The
typed error carries the rep's attempt directory, diagnostic, and transcript
copied into its record directory before temporary cleanup. Extend the
session-attempt record with an additive
EXECUTION_FAILED variant: no reply or checks, a non-empty error, optional
provider metrics when the returned evidence supplies them, and the preserved
transcript path. The confirmation adapter alone converts that typed failure to
an UNSUCCESSFUL rep with a `checks` EXECUTION_FAILED outcome and attempt-record
evidence. Fixture/corpus preparation, parsing, schema, persistence, and other
invariant failures remain untyped and abort group finalization; they are never
counted as benchmark outcomes.

Let `runConfirmation` settle all rep promises before classification, so a real
invocation failure cannot cancel its peers. Write fulfilled and typed-failure
rep records in ordinal order before finalization. The session branch of the
shared finalizer summarizes only `checks`, omits the pipeline-only final quality
row, and supplies no Judge-agreement model. A setup failure before reps exist
still refuses the whole group and does not invent rep records.

The mode-specific input type reaches the current comparison loader, whose
pipeline path requires pipeline files and Judge settings. Add an explicit
unsupported-session refusal before that path reads pipeline-only fields. This
is a compatibility guard, not session comparison: ACT-151 replaces it with the
multi-case session path and ACT-146 owns the remaining session quality and
single-case statistics.

### Acceptance observations

1. An injected outer-CLI test records the `$0.10` preflight plus rep maximum,
   approval, model probe, and rep execution in that order; declining or lacking
   approval records no probe or attempt. The written group retains the
   preflight maximum and its actual metrics or missing-metrics status; the
   rendered actual total is unavailable when those metrics are missing.
2. A session-confirmation test launches at least three reps from one frozen
   value, mutates the original fixture/transcript/corpus source after capture,
   fails one provider invocation, and observes the other reps complete against
   the original bytes. The group references every ordinal, the failed rep's
   `attempt.json` retains its error and transcript, and the failed rep is
   present.
3. A passing and a check-failing fake Claude envelope produce A/CONTINUE and
   F/STOP rep summaries while their `attempt.json` files retain the individual
   named check details. A no-reply and a typed invocation failure exercise
   NOT_REACHED and EXECUTION_FAILED without dropping peers. Both a rejected
   command and a valid `is_error` envelope take that path; malformed envelopes,
   injected schema failures, and record-write failures abort group finalization
   instead of becoming reps.
4. `list groups` returns the written `group:<id>`, and `show group:<id>` plus
   `show group:<id> --json` read the summary and strict record without starting
   a provider call.
5. Existing v1 stage, pipeline, and provisional session fixtures still parse.
   A session group whose corpus cannot be isolated refuses before the probe,
   naming ACT-143. Run `mise exec -- bun run test`,
   `mise exec -- bun run typecheck`, `mise exec -- bun run lint`, and
   `mise exec -- bun run fmt:check` after the focused tests.

First test to write: in `src/benchmark/session-confirmation.test.ts`, inject
three rep executions over one captured input bundle, make rep 2 raise the typed
provider-invocation failure after recording the input identity it received,
mutate the original source after capture, and assert reps 1 and 3 finish, all
three observed the same frozen identity and original bytes, rep 2 retains an
execution-failed `attempt.json`, and `group.json` references all three rep
records in ordinal order. It fails today because no session confirmation
runner exists.
<!-- SECTION:PLAN:END -->

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

Evidence: executeSessionRun rejects runConfirmed; frozenInputsSchema requires pipelinePath. The doc-69 injected outer-CLI probe records model probe, then $0.40 projection, then refusal. Inner-hook ordering does not establish the outer CLI spending boundary. The installed executable runs by absolute path; PATH resolution fails in this tool environment.

Unresolved claims/resources: No prerequisite for shaping. Claude 2.1.266 runs at /opt/homebrew/bin/claude; this session PATH omits /opt/homebrew/bin. Use a command-local PATH prefix for a future authorized provider check. Authentication and real-provider behavior remain unverified; executable presence grants no spending authority.

Next action: Shape the session-specific frozen-input record, isolated attempt mapping into runConfirmation, and approval-before-model-preflight ordering. Bound this to one shaping session without provider spend. Build can use injected runners; any real smoke needs an applicable recorded spend authorization.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).

Correction, 2026-09-09, by the overseeing session. The triage verdict above says 'The normal smoke command stops earlier because claude is missing from PATH' and that 'provider-level behavior remains unverified until the Claude executable is available'. That is wrong: 'command -v claude' returns /opt/homebrew/bin/claude on this machine. Provider-level verification is not blocked, so a build session can run the case for real rather than only with injected runners. Whatever stopped the smoke command earlier, a missing executable was not it.

The pipelinePath question stays open, and the triage sharpened it usefully: do not record a fabricated pipeline as if one ran. That framing is the constraint to design against, not a placeholder to fill.

## Shaping, 2026-09-09

Resolved unknowns:

1. The frozen-input representation is a v2 session branch selected by both
   `schemaVersion` and `mode`. It omits pipeline and Judge fields and freezes
   the loaded case declaration, fixture, transcript prefix, and declared corpus
   files under the group. The provisional v1 session shape remains readable;
   no placeholder pipeline is written by the new path.
2. The existing provisional session fixtures hide two further pipeline-shaped
   lies: `lineage` has no session variant and check evidence requires a Git
   `resultSha`. The session branch uses the session lineage already computed by
   `sessionLineage` and points check evidence directly at the persisted attempt
   record. Stage and pipeline shapes do not loosen.
3. One capture precedes all reps. `runSessionDebugAttempt` cannot be called as-
   is per rep because it resolves and snapshots the source anew each time; its
   prepare/execute-record seam must be exposed so confirmation can supply the
   same frozen bundle and rep-owned record directory repeatedly.
4. `runConfirmation` already supplies the required concurrency and all-settled
   boundary. Only a typed error thrown by the provider-invocation boundary is a
   failed rep; schema, persistence, input, and invariant failures abort group
   finalization. This keeps peer-failure accounting without laundering harness
   defects into the benchmark distribution.
5. The model probe belongs inside the execution selected by
   `runRequestedExecution`. Leaving it in `runSessionCase` can never satisfy
   approval-before-provider ordering because that function runs before the
   cost/approval boundary.
6. Existing group readers need no new list/show route. They enumerate and parse
   `confirmationGroupPaths`; producing a valid group record makes the session
   group visible. The current comparison boundary must reject session groups
   before pipeline-only validation; session comparison remains ACT-146/ACT-151
   work and must not be simulated with pipeline quality here.
7. No new glossary entry is needed. The plan uses the existing terms session
   case, confirmation group, rep, attempt directory, corpus snapshot, provider
   call, lineage, and rep outcome.
8. A rejected provider command or a valid provider `is_error` envelope gets an
   additive execution-failed attempt record with its diagnostic and captured
   transcript. That is the durable evidence the rep references. Malformed
   provider output and failures outside envelope classification do not get a
   synthetic benchmark outcome.
9. The paid model probe is fixed group overhead. Its `$0.10` ceiling is part of
   the approved maximum and its actual metrics or explicit absence are stored
   on the group; otherwise both “maximum” and total-cost summaries would be
   false by as much as `$0.10` per command. Missing preflight metrics suppress
   the numeric actual-total summary rather than silently printing rep cost.
10. The session route has no current noninteractive confirmation guard. It must
    call the existing guard before entering `runRequestedExecution`, matching
    pipeline behavior.

Approach survey:

- Leave confirmed sessions unsupported: ruled out by AC #1/#2 and because this
  card blocks the already-approved ACT-69 comparison.
- Reuse pipeline confirmation with sentinel `pipelinePath`, source SHA, Git
  result SHA, and empty Judge fields: rejected because those values assert a
  pipeline, repository lineage, result commit, and Judge that never existed.
- Run N ordinary debug attempts and group their records afterward: rejected
  because each debug attempt snapshots independently, so a changing source can
  give peers different inputs.
- Remove the paid model preflight from confirmed sessions: rejected because
  ACT-88 requires an unavailable model to halt in preflight rather than turn
  requested reps into execution evidence. The approved maximum therefore has
  to include the call.
- Chosen: one session-specific adapter over generic `runConfirmation`, a
  mode-specific record branch, and the existing session-attempt executor after
  extracting its frozen-input seam. It adds no provider abstraction and leaves
  pipeline orchestration intact.

Hardening and reversibility: the new session module owns the only new
orchestration path and depends inward on existing case, attempt, confirmation,
record, and layout contracts. The parser keeps the complete legacy v1 branch;
new session records use v2, and recorded stage/pipeline v1 files retain their
exact shape. ACT-143 can later widen which frozen corpus kinds are deliverable,
and ACT-145 can preserve more attempt working state, without changing group
IDs, rep IDs, or the attempt-record evidence link.

No provider call was made while shaping. This card has no provider-spend
authorization of its own; build verification uses injected runners. The
old `$0.40` smoke projection omits the probe ceiling; the shaped expectation is
`$0.50` (`$0.10` preflight plus two `$0.20` reps). That is a future operator
probe, not authorized evidence for the build session.

Review completed before handoff with adversarial-review because this shaped
card is a document; findings and dispositions follow.

## Adversarial review, 2026-09-09

The independent reviewer reported every finding below. Its quoted wording is
preserved; the disposition after each quote is this shaping session's.

1. **Blocking.**

   > The approved “maximum” omits the paid model probe. ACT-140 lines 39 and
   > 94–99 promise that approved projected cost bounds provider spend, while
   > lines 118–120 explicitly place the probe after approval.
   > `defaultModelProbe` has its own `$0.10` ceiling
   > (`src/benchmark/preflight.ts:55–62, 77–90`), but session projection remains
   > only `reps × sessionBudgetUsd` (`src/benchmark/confirmation.ts:29–61`). For
   > two `$0.20` reps, the UI approves `$0.40` although the command can spend
   > `$0.50`; the existing projected-cost record also has no fixed-overhead
   > field. The probe’s metrics are discarded, so the resulting resource report
   > would understate actual command cost too. Command-verified with
   > `mise exec -- bun -e` over `projectConfirmationCost` and
   > `defaultModelProbe`, which printed `repCap: 0.4`, `probeBudget: 0.1`,
   > `wholeCommandCap: 0.5`. The plan must either include the probe in projection
   > and durable cost evidence, or replace/remove the paid probe.

   Disposition: fixed in the plan. The session projection now includes the one
   exported preflight ceiling, v2 group evidence retains the actual preflight
   metrics or their explicit absence, and the summary adds the fixed call to
   the rep costs. Removing the probe is ruled out by ACT-88's unavailable-model
   preflight requirement.

2. **Blocking.**

   > “Convert a rejected rep” is too broad and will record infrastructure or
   > invariant failures as benchmark outcomes. ACT-140 lines 101–107 and
   > 215–218 direct the adapter to turn every rejected `runConfirmation` outcome
   > into `EXECUTION_FAILED`. `executeRep` catches every thrown value without
   > classification (`src/benchmark/confirmation.ts:141–152`), so an
   > `attempt.json` ENOSPC, schema bug, or record-write error is indistinguishable
   > from a provider invocation failure. Concrete counterexample: an executor
   > throwing `Error("attempt.json write failed: ENOSPC")` returns a normal
   > rejected outcome which the plan says to convert into a valid unsuccessful
   > rep. Command-verified with `mise exec -- bun -e` over `runConfirmation`,
   > which returned `{"status":"rejected","reason":"Error: attempt.json write
   > failed: ENOSPC"}`. Define a typed invocation-failure result/error that alone
   > becomes rep evidence; propagate setup, persistence, and invariant failures
   > so the group is not falsely finalized.

   Disposition: fixed in the plan. Only `SessionInvocationError` from a rejected
   provider command or a parsed provider error envelope becomes an unsuccessful
   rep. Every other rejection prevents group finalization.

3. **Blocking.**

   > The promised evidence for an invocation-failed rep cannot be represented by
   > the existing attempt contract. ACT-140 lines 52–58 say the confirmation path
   > writes a full `attempt.json` and transcript for each rep, while lines 74–77
   > and 101–104 require thrown invocations to become execution-failed reps.
   > Today `runSessionAttempt` only copies the transcript after `runClaude`
   > fulfills and deletes both temporary attempt and transcript state on any
   > throw (`src/benchmark/session-attempt.ts:264–301, 309–355`);
   > `runSessionDebugAttempt` writes `attempt.json` only after that function
   > resolves (`src/cli/session-run-command.ts:243–267`). Moreover,
   > `sessionAttemptRecordSchema` accepts only
   > `SUCCESSFUL | UNSUCCESSFUL | NO_REPLY` and has no error field
   > (`src/benchmark/session-record.ts:132–161`). Command-verified by parsing an
   > `EXECUTION_FAILED` attempt with `mise exec -- bun -e` over
   > `sessionAttemptRecordSchema.safeParse`; it rejected both the outcome and
   > `error`. The card must decide whether failed invocations get a new
   > attempt-record variant with preserved transcript/error evidence, or
   > explicitly have no `attempt.json` and use optional rep evidence.

   Disposition: fixed in the plan. A rejected provider command or parsed error
   envelope gets an additive execution-failed session-attempt variant, and its
   transcript is copied before temporary cleanup; the rep links that durable
   record.

4. **Should-fix.**

   > The proposed v1 schema change is not additive. ACT-140 lines 62–77 and
   > 247–253 call the new strict session branch additive for a “previously
   > unwritten” mode, but the current public parser and tests explicitly accept
   > schema-version-1 session records containing pipeline-shaped `SOURCE`
   > lineage, `pipelinePath`, Judge fields, and `resultSha`
   > (`src/benchmark/confirmation-record.test.ts:124–147, 275–286`). A strict
   > replacement session branch will make those previously valid v1 bytes
   > unreadable. Command-verified with
   > `mise exec -- bun test src/benchmark/confirmation-record.test.ts`, which
   > passed both v1 session fixtures. Choose a version bump, retain a legacy v1
   > session read branch, or explicitly authorize invalidating the existing
   > contract and update the compatibility claim.

   Disposition: fixed in the plan. The entire v1 parser branch remains; the
   honest session writer and schemas are v2.

5. **Should-fix.**

   > The claimed outer noninteractive approval check does not exist on the
   > session route. ACT-140 lines 94–99 say the outer CLI “continues”
   > noninteractive checks, and lines 118–120 require lacking approval to produce
   > no probe or attempt. `refuseWithoutTerminal` enforces this only on the
   > pipeline path (`src/cli/run-command.ts:139–142, 168–177`);
   > `runSessionCase` calls only `requireSpendAuthorization` and then proceeds
   > (`src/cli/run-command.ts:185–205`). Command-verified by invoking
   > `runRunCommand` with a session case, explicit model,
   > `--confirm --reps 2`, no `--yes`, and `stdinIsTerminal:false`; the injected
   > trace was `["probe","executeSession","out:/dev/null"]`. Add the session
   > confirmation terminal gate and a test parallel to the pipeline test at
   > `src/cli/run-command.test.ts:410–432`.

   Disposition: fixed in the plan and acceptance observations. The session route
   now explicitly calls the terminal guard before the paid boundary.

6. **Should-fix.**

   > The orchestration ownership is misstated: the shared finalizer does not
   > write `rep.json`. ACT-140 lines 45–49 assign `rep.json`, `report.json`, and
   > `group.json` to `finalizeConfirmationGroup`, but that function reads
   > already-written rep records (`src/benchmark/confirmation-evidence.ts:168–180`)
   > and writes only report and group (`:221–246`). This leaves no explicit
   > persistence owner for synthetic rejected-rep records—the exact records AC
   > #5 depends on. Command-verified with
   > `nl -ba src/benchmark/confirmation-evidence.ts | sed -n '168,258p'`. Assign
   > rep-record writing to the session adapter before finalization and specify
   > failure behavior if any rep record cannot be persisted.

   Disposition: fixed in the chosen boundary. The session adapter writes every
   rep first; a failed write aborts finalization.

7. **Note.**

   > The opening scope says “Run existing session cases” (`ACT-140:23`), while
   > the chosen boundary refuses cases declaring skills or global inputs
   > (`:88–90`). Five of the ten current session cases declare `CLAUDE.md` or
   > `skills/`, so the implementation will support only a subset until ACT-143.
   > Command-verified with `rg -n '"kind": "session"' cases/*/case.json | wc -l`
   > and `rg -l '"CLAUDE.md"|"skills/' cases/*/case.json`, yielding 10 session
   > cases and 5 affected cases. Record the supported subset and add a refusal
   > test so this limitation is visible rather than inferred.

   Disposition: fixed as an explicit supported boundary and AC #7. The count and
   reproducing commands are recorded above; ACT-143 remains the owner of the
   deferred delivery capability.

### One permitted review rerun

The fixes changed behavioral claims, so the same reviewer checked the seven
dispositions once more, as the adversarial-review gate allows.

1. **Blocking.**

   > A valid provider error envelope still falls outside the proposed typed
   > invocation boundary. The revision says `SessionInvocationError` is created
   > “at the exact `runClaude` call” and that parsing failures stay untyped and
   > abort finalization (ACT-140:121–131). But `runClaude` may fulfill with a
   > valid envelope carrying `is_error: true`; `readClaudeEnvelope` then throws
   > only afterward (`src/benchmark/claude.ts:68–74`). That is provider execution
   > evidence, not malformed parsing, yet the plan would abort the whole group
   > instead of recording the failed rep required by AC #5. Command-verified
   > with `mise exec -- bun -e` over `readClaudeEnvelope` using a valid
   > `is_error: true` envelope; the fulfilled output subsequently threw
   > `Error:session exhausted its budget`. Define the typed boundary around
   > command execution plus valid envelope interpretation, distinguishing a
   > parsed `is_error` envelope from malformed JSON/schema output.

   Disposition: fixed in the plan. The typed provider-execution boundary now
   includes rejected commands and parsed `is_error` envelopes; malformed JSON
   and schema-invalid envelopes abort finalization.

2. **Should-fix.**

   > Missing preflight metrics still leave the group summary able to understate
   > actual cost. ACT-140:88–96 permits an explicit missing-metrics preflight
   > status but also says the summary’s actual total covers the whole command;
   > ACT-140:149–152 verifies storage of the missing status, not that displayed
   > cost becomes unavailable. `readClaudeCallMetrics` legitimately returns
   > `undefined` for a successful envelope without complete usage fields
   > (`src/benchmark/claude.ts:77–91`), while `groupSummary` always sums numeric
   > `resources.total.costUsd` and prints that as total cost
   > (`src/benchmark/record-summary.ts:143–167`). Concrete counterexample:
   > missing preflight metrics plus two `$0.20` rep metrics still renders
   > `Cost $0.40 over 2 reps`, silently excluding the paid probe. Command-verified
   > with `mise exec -- bun -e` over `readClaudeCallMetrics` and `groupSummary`,
   > which returned no preflight metrics and printed that `$0.40` summary.
   > Specify that missing group-level preflight metrics make total command cost
   > unavailable, and test the rendered summary.

   Disposition: fixed in the plan and acceptance observation #1. Missing
   preflight metrics suppress the numeric actual-total summary.

The rerun reported no notes. No finding remains open. The review covered a
shaped document; no code-review axis was run.
<!-- SECTION:NOTES:END -->
