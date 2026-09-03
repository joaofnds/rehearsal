---
id: ACT-26.3
title: review and calibrate a run without a paused process
status: Build
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-03 02:45'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 24008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today a run pauses at AWAITING_HUMAN_REVIEW with the candidate in the target and loops on "press Enter" until the review file and rubric edits validate, then asks "type yes" to confirm the revised Judge. An agent cannot hold that process. Make the pause optional: a run without --pause writes the preliminary artifact, pins the candidate under a retention ref, restores the target, and exits. rehearsal review <run> --file <review.json> (or --verdict, --summary, --finding flags) records the human or agent review; rehearsal calibrate <run> rejudges the frozen evidence with the current rubrics and instructions, validates the findings the way collectCalibration does today, and records the result, including the agreement snapshot, without asking anything; a --confirm-rejudge flag stands in for the typed yes. rehearsal show <run> --checkout <dir> materializes the retained candidate for inspection. --pause keeps today's flow for João.

Calibration already rejudges frozen evidence, not the live target, so nothing is lost by restoring first. Gap 4 in doc-1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal run` without `--pause` and with stdin not a TTY passes the terminal gate: over a fake harness a test asserts no RefusedPreconditionError is raised and the run proceeds to its first step, and `echo | bun run rehearsal run --target <nonexistent>` fails on the target instead of exiting 3 with the ACT-26.3 message
- [ ] #2 `rehearsal run --pause` with stdin not a TTY exits 3 before any provider call, printing nothing on stdout and one stderr line saying the pause needs a terminal
- [ ] #3 `rehearsal run --help` lists `--pause` with its help line, generated from the COMMANDS table, and `rehearsal --help` lists `review` and `calibrate` with one summary line each
- [ ] #4 A run without `--pause` writes the artifact with status AWAITING_HUMAN_REVIEW, calls recordRetentionRef with the final candidate's resultSha before the target is restored, restores the target, prompts nothing, and returns the run paths: a test with fake dependencies asserts the recorded ref name is refs/rehearsal/<run>, that the questioner was never asked, and that the ref was recorded before the restore
- [ ] #5 A run without `--pause` whose stage Judge returns STOP records the stage file and exits without prompting; the questioner is never asked and the stage record carries no calibration
- [ ] #6 A run failure without `--pause` restores the target without asking anything: the failure pause is skipped rather than degraded, and a test asserts the questioner received no question
- [ ] #7 `rehearsal review <run> --verdict REJECT --summary <text> --finding <json>` exits 0, writes <run>.review.json, and the bytes it wrote parse under humanReviewSchema with the given verdict, summary, and one finding; repeating `--finding` records each one in order
- [ ] #8 `rehearsal review <run> --file <review.json>` exits 0 and writes the parsed review to <run>.review.json; a file whose contents humanReviewSchema rejects exits 2 with the schema's own message on stderr and leaves any existing review file unchanged
- [ ] #9 `rehearsal review` with both `--file` and any of `--verdict`, `--summary`, or `--finding` exits 2 naming the conflict; with neither exits 2 naming what it needs
- [ ] #10 `rehearsal review <run>` for a run with no artifact exits 3 naming the run and writes no file
- [ ] #11 `rehearsal review <run> --json` prints the review record's own bytes on stdout and nothing else, and JSON.parse of the whole stdout equals the bytes of the file it wrote
- [ ] #12 `calibrate(frozen, current, review, judges)` is a pure function of its arguments: it reads no file, prompts nothing, and returns a CalibrationResult or throws CalibrationIncompleteError; a test calls it twice with the same arguments and a fake judge and gets the same result, and a test asserts it makes no file read by passing rubric and instruction text rather than paths
- [ ] #13 `collectCalibration` keeps today's read-edit-retry behavior by calling that function inside its loop: the existing calibration.test.ts tests pass unchanged, including the re-prompt after invalid review JSON and the stage-rubric rejudge that retains Judge attempts
- [ ] #14 `rehearsal calibrate <run>` over a run artifact whose stage rubric changed since the run, without `--confirm-rejudge`, exits 3, prints the revised stage grades on stderr, leaves the artifact's status AWAITING_HUMAN_REVIEW, and writes nothing into the artifact file
- [ ] #15 `rehearsal calibrate <run> --confirm-rejudge` over that same run exits 0 and rewrites the artifact with status COMPLETE, a calibration whose rejudgeConfirmedByHuman is true and whose stageRubricsChanged names the edited stage, and a judgeAgreement produced by loadJudgeAgreementReport
- [ ] #16 `rehearsal calibrate <run>` where no rubric and no instructions changed since the run exits 0 without `--confirm-rejudge`, makes no provider call, and completes the artifact with a calibration carrying no revised grade
- [ ] #17 `rehearsal calibrate <run>` whose review is inconsistent with the grades exits 3 with the CalibrationIncompleteError message on stderr and leaves the artifact at AWAITING_HUMAN_REVIEW
- [ ] #18 `rehearsal calibrate <run>` for a run with no review file exits 3 naming the review file and making no provider call; for a run already COMPLETE it exits 3 saying so and does not rejudge
- [ ] #19 `rehearsal calibrate <run>` over a run stopped at a stage completes that stage's record instead of the artifact: the stage file gains its calibration and judgeAgreement, and the same command handles both cases without a flag naming which
- [ ] #20 `rehearsal show run:<name> --checkout <dir>` adds a detached worktree of refs/rehearsal/<name> in the run's recorded sourceRoot at <dir>, prints only that path on stdout, and exits 0; the worktree's HEAD is the artifact's resultSha
- [ ] #21 `show run:<name> --checkout <dir>` where <dir> already exists, or where the target holds no refs/rehearsal/<name>, exits 3 naming what is missing and creates no worktree
- [ ] #22 `--checkout` on any id other than a run exits 2 saying `--checkout` takes a run id
- [ ] #23 `rehearsal review`, `rehearsal calibrate`, and `show --checkout` each accept the run under both `run:<name>` and a bare `<name>`, and a run id naming a path outside the runs directory exits 2 with the record-id refusal
- [ ] #24 An artifact written before this card, carrying no retention ref and status AWAITING_HUMAN_REVIEW, is still readable by `review` and `calibrate`, and one written by this card is still readable by `show run:<name>` and by loadJudgeAgreementReport: a test parses a pre-card artifact fixture and a post-card one through the same reader
- [ ] #25 README's Human Calibration and Tuning Loop sections describe both paths: the no-pause run followed by `review` and `calibrate`, and `--pause` as today's interactive loop, and name what `--confirm-rejudge` stands in for
- [ ] #26 The whole suite runs offline and free: every test for review, calibrate, and --checkout builds its run artifact in a temporary runs directory and injects a fake judge, no test invokes claude, and no test writes into the repository's .benchmark-runs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Goal

A run an agent can drive: without `--pause` it grades, writes the preliminary
artifact, pins the candidate under a retention ref, restores the target, and
exits, and `rehearsal review`, `rehearsal calibrate`, and
`show run:<name> --checkout <dir>` do afterwards what the paused process did
while it held the target. `--pause` keeps today's interactive loop for João.

## What is actually there, observed this dispatch

Every line below is a file read or a command run in this dispatch.

1. **`run`'s TTY refusal is already conditional, not unconditional.**
   `src/cli/run-command.ts:127-129` refuses only when `config.confirmation`
   is absent or unapproved; ACT-26.1's review narrowed it to the debug path.
   Observed: `echo | bun run rehearsal run --target /nonexistent --model sonnet
   --session-budget-usd 1` exits 3 with `stdin is not a terminal: the review
   pause has no flag alternative until ACT-26.3, so a run needs a TTY`. This
   card replaces that predicate with `--pause`, and `REVIEW_PAUSE_REASON`
   (run-command.ts:72) is the one string that changes with it.
2. **Three prompts exist and this card must account for all three.**
   `collectCalibration` (calibration.ts:265 and :361) asks the edit-and-retry
   question and the "type yes" confirmation; `runBenchmark` (run.ts:946) asks
   the failure pause. Only the failure pause degrades today (it catches and
   restores). Without `--pause`, none of the three may be reached.
3. **The calibration pause is reached from two places, not one.**
   `runBenchmark` calls `collectCalibration` at run.ts:902 after the final
   Judge, and `runGradedStages` calls it through `calibrateStageFailure`
   (run.ts:826, wired at run.ts:616) when a stage Judge returns STOP. The
   stopped-stage branch completes the *stage* record (run.ts:624), not the
   artifact. `calibrate` therefore has two records it may complete and must
   pick by what the run left behind, not by a flag.
4. **`loadJudgeAgreementReport` reads the runs directory itself**
   (judge-agreement.ts:359-419), scanning every `*.json` for a recorded
   calibration and taking the current one as an argument. `calibrate` can call
   it exactly the way `runBenchmark` does at run.ts:923; nothing has to be
   threaded through the artifact.
5. **The run artifact has no zod schema.** `RunArtifact` is a TypeScript
   interface (contracts.ts:348-361) written by `buildRunArtifact` and parsed by
   nothing; ACT-26.2 recorded the same finding and answered it with a narrow
   summary schema. `review` and `calibrate` are the first commands that must
   read an artifact back for its *evidence*, not to render it.
6. **`recordRetentionRef` and the worktree helpers exist.**
   `target.ts:184` runs `git update-ref refs/rehearsal/<run> <sha>`;
   `retainedCheckpointRecorder` (run.ts:300) already pins every checkpoint
   under that name during a run. `addWorktree` (target.ts:412) runs
   `git worktree add --detach <path> <sha>`. Nothing enumerates retention refs.
7. **No run artifact exists on this machine.** `find .benchmark-runs -maxdepth 2`
   shows only `comparisons/` (empty), `cases/smoke/`, and `sessions/`; no
   `*.json` at the top level at all. Producing an AWAITING_HUMAN_REVIEW artifact
   costs a full pipeline run, well over Build's per-observation cap. Every
   observation Build takes must build its artifact from a fixture in a
   temporary runs directory, the way run.test.ts and calibration.test.ts
   already do.
8. **The suite is green here.** `bun test` this dispatch: 931 pass, 0 fail
   across 63 files. The dispatch predicted five pre-existing failures from a
   fresh clone; they do not reproduce in this working tree. Build should read a
   failure as its own, not as inherited, and re-check this number before
   claiming otherwise.
9. **`--pause` is a switch the parser must learn.** `SWITCH_FLAGS`
   (config.ts:139) holds exactly `--confirm` and `--yes`; a flag not in that
   set consumes the next argument as its value. `--pause` and
   `--confirm-rejudge` each go in that set as well as in the COMMANDS table,
   or they silently swallow the following flag.

## Unknowns, and how each was resolved from the repository

1. **Where the boundary between the loop and the judgment falls.** Resolved
   from `collectCalibration`'s body: the loop is `prompt → read four sources →
   compare → rejudge → validate → confirm`, and only the first and last steps
   need a human. Everything between is a function of the frozen scorecards and
   grade, the current instruction and rubric text, the review, and the judges.
   That function is `calibrate`; the loop keeps the prompting and the file
   reads. This is the split the card's two callers already ask for.
2. **What "the frozen side" is, exactly.** From `CalibrationContext`: the
   original instructions, the original final rubric, the final candidate (its
   original grade, baseline context, diff, changed paths, and both check
   results), and the stage scorecards with their own `rubric` and `rubricPath`.
   Every one of those is already in the artifact (`RunArtifactEvidence`:
   `instructions`, `rubric`, `grade`, `baselineContext`, `diff`,
   `changedPaths`, `checkIntegrity`, `localChecks`, `stageScorecards`). So
   `calibrate <run>` needs no state beyond the artifact and the current files.
3. **Where the current rubric text comes from for a stage.** From
   calibration.ts:288: `Bun.file(scorecard.rubricPath).text()`, the path the
   scorecard recorded, not a path recomputed from the case. Build's observation
   depends on this, which is why its fixture must point `rubricPath` at a file
   it can edit.
4. **Whether restoring first loses anything.** No. Every input the rejudge
   reads is in the artifact or in the control repository; nothing reads
   `targetDir`. `collectCalibration` takes `targetDir` only to name it in the
   prompt text (calibration.ts:266). Confirmed by reading every use of
   `context.targetDir` in that file: there is one, and it is a string in a
   question.
5. **Which record `calibrate` completes.** Resolved by what the run wrote: an
   artifact at AWAITING_HUMAN_REVIEW means the final path; a stage file whose
   scorecard verdict is STOP and which carries no calibration means the
   stopped-stage path. Both are on disk under the run's name
   (`run-layout.ts:96-101`), so the command reads what is there rather than
   asking which case it is in.
6. **Whether `review` needs its own schema.** No. `humanReviewSchema`
   (contracts.ts:158) is the parser, and `parseHumanReview` already wraps it
   into a `CalibrationIncompleteError`. `review` parses at its own boundary and
   raises a `UsageError` for a malformed `--file` or `--finding`, because the
   caller made a mistake on the command line.
7. **How `--checkout` finds the repository.** The artifact records
   `sourceRoot` and `resultSha`. `show run:<name> --checkout <dir>` reads the
   artifact for `sourceRoot`, then adds a worktree of `refs/rehearsal/<name>`
   there. It does not take a `--target` flag: the run recorded which repository
   it ran in, and a second answer could disagree with the first.
8. **Whether a bare run name is acceptable where an id is.** `review` and
   `calibrate` take a run and nothing else, so both forms parse to the same
   `RunRecordId` through `record-id.ts`, which is also what refuses a segment
   that escapes the runs directory. `show` keeps requiring the prefix, because
   it accepts seven kinds and must not guess.

## Decided autonomously

Nobody was available to answer during this dispatch. Each of these follows the
dispatch's decision policy and can be reversed by João.

1. **The pure function is `calibrate(frozen, current, review, judges)`, taking
   text rather than paths, and the file reads stay in its callers.** Reason:
   this is the dispatch's recommended design and it is what makes the same
   judgment reachable from a retry loop and from a one-shot command (§5,
   deterministic core and imperative shell). It also makes Build's first test
   free: no temp directory, no clock, no provider.
2. **`--pause` is a switch on `run` only, not on `replay`.** Reason: `replay`
   never calls `collectCalibration` (grepped: the only callers are run.ts:826
   and run.ts:902). A flag on a command that cannot use it is a flag with no
   case (YAGNI, §12). Trigger: a replay path that grows a calibration step.
3. **Without `--pause`, the failure pause is skipped, not degraded.** Reason:
   the card says a run without `--pause` never prompts, and the existing
   degradation (catch the readline error, restore) reaches a prompt first and
   only recovers because stdin is closed. Skipping is the behavior; degrading
   is an accident that happens to look like it.
4. **Without `--pause`, a stopped stage writes its record and the run ends
   there, uncalibrated.** Reason: the stopped-stage branch's whole body is the
   calibration pause. `calibrate <run>` completes that record afterwards, which
   is criterion 20's behavior. The alternative, calibrating a stage
   non-interactively inside the run, would rejudge before any human has written
   a review.
5. **`calibrate` refuses with exit 3 when a rejudge happened and
   `--confirm-rejudge` is absent, printing the revised grades on stderr and
   writing nothing.** Reason: the glossary's Exit code entry puts "a needed
   approval whose flag is absent" at 3, and the typed yes it stands in for is
   an approval of a result the caller has not seen yet. Printing the grades is
   what makes the second invocation informed rather than blind.
6. **A calibration that needed no rejudge completes without
   `--confirm-rejudge`.** Reason: `collectCalibration` only asks for the typed
   yes when `revisedGrade || revisedStageScorecards.length > 0`
   (calibration.ts:360). The flag stands in for that question, so it is
   required exactly where the question was asked.
7. **`review` writes the review file and nothing else; it does not calibrate.**
   Reason: two commands, two records, and a review that is rejected by
   calibration should not be lost. The card names them separately.
8. **`--checkout` is a flag on `show`, not a `checkout` command.** Reason: the
   card's own words, and `show` already owns "materialize what this id names"
   for the caller. Trigger to split: a checkout that takes options of its own.
9. **The retention ref is pinned by the same `recordRetentionRef` the
   checkpoint recorder uses, under `refs/rehearsal/<run>`, before the restore
   in the no-pause path.** Reason: the ref already exists with that name and
   that comment (target.ts:178-190); a second naming scheme for the same
   purpose would be a second thing to know. The final candidate's `resultSha`
   is usually the build checkpoint's sha, but the artifact's `resultSha` is the
   one the artifact claims, so that is what gets pinned.
10. **No schema version bump, and no new required field.** Reason: this card
    adds no field to the artifact that a reader must have. A pre-card artifact
    has no retention ref, which `--checkout` reports as a missing ref rather
    than as an unreadable record; a post-card artifact is the same shape the
    pause path writes. Records stay readable in both directions (policy rule 4),
    which criterion 24 observes.
11. **`review` and `calibrate` take the run positionally, accepting
    `run:<name>` or a bare `<name>`.** Reason: `run` names one kind, so the
    prefix carries no information the command lacks, and every id `list runs`
    prints is still accepted. The parse still goes through `record-id.ts`, so
    the path-escape refusal holds for both forms.
12. **`--finding` takes one JSON object per occurrence.** Reason: a finding has
    five fields including a path list, and inventing a flat mini-syntax for it
    would be a second grammar for a shape `humanReviewSchema` already states.
    The card's own sentence names `--finding` as a flag, not as a language.

## Not built, and why

Each is named by the card, doc-1, or the direction, and has no case here.

- **An agent-written review helper beyond the flags** (a template generator, a
  findings editor). The dispatch excludes it. Trigger: an agent that cannot
  produce a finding object from `show run:<name>` output.
- **Multi-run calibration** (`calibrate` over more than one run). Excluded by
  the dispatch. Trigger: a tuning loop that edits one rubric and wants every
  affected run recalibrated in one command.
- **A full zod schema for the run artifact.** `calibrate` parses the fields it
  uses at its boundary, the way ACT-26.2's summary schema does. Trigger: a
  command that must validate an artifact it did not write.
- **Listing or pruning retention refs** (`rehearsal list retained`, a gc
  command). No caller: `--checkout` names the ref from the run. Trigger: refs
  accumulating enough to need cleanup, which is its own card.
- **`--pause` on the confirmation path.** `pipeline-confirmation.ts` holds no
  Questioner and never calibrates; ACT-26.1's review established that. Trigger:
  a confirmation group that grows a human step.
- **A `--checkout` that removes the worktree afterwards.** The caller owns the
  directory it named; `removeWorktree` exists for a caller who wants it.
  Trigger: a checkout that the harness itself creates and must clean up.

## Implementation plan

Ordered so each step is committable and the suite stays green.

1. **Extract `calibrate` from `collectCalibration`, behavior-preserving.** A
   new pure function taking the frozen side (original instructions, original
   final rubric, final candidate, stage scorecards), the current side (updated
   instruction text, updated final rubric text, updated stage rubric text per
   scorecard), the parsed review, and the judge functions; returning
   `CalibrationResult` or throwing `CalibrationIncompleteError`. The typed yes
   becomes a `rejudgeConfirmed: boolean | undefined` argument rather than a
   prompt. `collectCalibration` keeps the loop, the four file reads, and both
   questions, and calls it. Its existing tests are the pin and do not change.
2. **`--pause` on `run`.** Add it to `SWITCH_FLAGS` and the COMMANDS table;
   thread it into `BenchmarkConfig`; move the terminal gate onto it. Without
   it, `runBenchmark` skips both calibration calls and the failure pause, pins
   the retention ref, and returns. With it, nothing changes.
3. **`rehearsal review`.** A command module in `src/cli/`: parse the run id,
   read the artifact to confirm the run exists, build the review from
   `--file` or from the flags, parse it through `humanReviewSchema`, write
   `<run>.review.json`, print its path or its bytes.
4. **`rehearsal calibrate`.** Read the artifact and the review, pick the final
   or the stopped-stage record, read the current instruction and rubric text,
   call `calibrate`, and on a rejudge without `--confirm-rejudge` print the
   grades and refuse. On success write the completed record with
   `completeRunArtifact` or the stage equivalent plus
   `loadJudgeAgreementReport`.
5. **`show --checkout`.** A flag on `show`; for a run id, read `sourceRoot`
   from the artifact and `addWorktree(sourceRoot, refs/rehearsal/<name>, dir)`;
   print the directory. Refuse a non-run id, an existing directory, and a
   missing ref.
6. **README and CLAUDE.md.** Rewrite Human Calibration and the Tuning Loop for
   the two paths; add `review` and `calibrate` to CLAUDE.md's command list.

## First test to write

In `src/benchmark/calibration.test.ts`, before the extraction:

> `calibrate` returns a calibration recording a stage rubric change and its
> revised scorecard, from values alone

Arrange the frozen side as one stopped stage scorecard (the one
`calibration.test.ts` already builds at its `stageScorecard` helper) plus the
original instruction and rubric text; the current side as the same instruction
text and an edited stage rubric whose requirement description differs; the
review as a `MISSED` finding against that requirement; and a fake stage judge
returning a scorecard that fails it. Act by calling `calibrate` once. Assert
`stageRubricsChanged` names the stage, `revisedStageScorecards` holds the fake's
scorecard, and no file was read and no prompt asked (the arguments are the only
inputs, so the fake judge is the only collaborator).

It fails now because the function does not exist, and it is the test that pins
the boundary the whole card turns on: the judgment is a value, and the prompting
is its caller's problem.

The second test is `run --pause` without a TTY exits 3 while plain `run` does
not, which forces the flag through the parser, the table, and the gate together.
<!-- SECTION:NOTES:END -->
