# Rehearsal

This repository controls an authentic rehearsal of the development workflow used in the NestJS template. It gives a known task to Claude Code, lets the installed workflow skills produce and execute the work, grades the committed result, pauses for human calibration, and restores the target repository.

The benchmark runs directly in the target repository on `main`. It does not use a clone, branch, or worktree. That is deliberate: the goal is to measure behavior in the same repository, path, instruction hierarchy, settings, skills, hooks, memories, and tool environment used for real work.

Where this is heading — a stage-replay corpus-tuning tool — is written in [docs/vision.md](docs/vision.md) and [docs/design.md](docs/design.md). Domain terms live in [GLOSSARY.md](GLOSSARY.md).

## What The Benchmark Measures

The benchmark tests whether the current instruction corpus and workflow can turn a rough backlog item into production-quality committed code with almost no human intervention.

One run uses:

```text
rehearsal/CLAUDE.md                          project instructions under evaluation
rehearsal/cases/<id>/case.json               the case declaration: id, kind, title, inputs, target
rehearsal/cases/<id>/backlog-seed.md         known feature request
rehearsal/cases/<id>/product-brief.md        stable product facts available to the PO
rehearsal/cases/<id>/pipelines/*.json        the workflow: board columns, stages, skills, rubrics
rehearsal/cases/<id>/rubrics/*.json          process-quality rubrics a stage adopts
rehearsal/cases/<id>/rubric.md               external binary acceptance rubric
rehearsal/cases/<id>/fixture/                a session case's seed tree, if it declares one
.benchmark-runs/cases/<id>/*.jsonl           a session case's transcript prefixes, git-ignored
target repository                            real application and real main branch
installed Claude skills                      whichever skills the pipeline names
installed styles and agents                  whichever a session case names as corpus
```

Everything but `CLAUDE.md` and the installed skills belongs to one benchmark case
under `cases/<id>/`. `CLAUDE.md` and the skills are the corpus under evaluation, so
they stay at the control root; the case is the frozen task, not the corpus. Cases
live in this repository, never beside the corpus they grade. `rehearsal run` uses
`audit-log` when `--case` is absent; `rehearsal case list` and
`rehearsal case show <id>` read the declarations.

A case is one of two kinds. A `pipeline` case runs the stage graph against a
target repository, which is everything above. A `session` case runs one Claude
session in a fresh directory the harness owns, optionally resumed from a
captured transcript prefix, and judges it with a deterministic check list over
the reply and the transcript. Both are declared as data under `cases/<id>/` and
both write the same records.

The executing sessions never receive the case's `rubric.md` and are not told that their work is being graded. Only normal project instructions, backlog artifacts, and Product Owner decisions enter the target workflow.

## Workflow

```text
clean target repository on main
        |
        v
record original SHA and back up backlog/ + .boris/
        |
        v
run the pipeline's baseline target checks
        |
        v
create a real Backlog.md card and install CLAUDE.md
        |
        v
for each pipeline stage:
  fresh /<skill> session <-> shared dynamic Product Owner
        |
        v
  independent stage Judge; stop below B
        |
        v
delivery stage additionally: verify commits, clean
worktree, checks, and check integrity
        |
        v
independent final Judge applies the external product rubric
        |
        v
write preliminary artifact and human-review template
        |
        v
human review updates CLAUDE.md and/or the case's rubric.md
        |
        v
rejudge the same candidate when the case's rubric.md changed
        |
        v
validate and record calibration
        |
        v
reset main to the original SHA and restore workflow artifacts
```

The pipeline is configuration, not harness code: every user brings their own workflow. A definition, selected with `--pipeline` and defaulting to the one the selected case declares, declares the target checks and check-integrity files, the board columns the target's Backlog.md uses, each stage's name, kind, and skill, the rubric its Judge applies, and optionally the durable document a planning stage must attach. A stage that records its output only on the task card declares no artifact. Stages can be added, removed, renamed, or reordered without changing the harness; a pipeline must declare exactly one delivery stage and place it last.

The default pipeline follows the currently installed workflow: a `shape` stage that turns the request into acceptance observations on the card, then a `build` stage that delivers the implementation.

Each engineering stage starts a distinct Claude session. A stage may take multiple turns when it needs product input, but no stage inherits another stage's conversation. Durable Backlog.md documents carry the work forward instead. A separate fresh Judge grades each completed stage before its output can become the next stage's input.

## Dynamic Product Owner

There is no predetermined answer file.

When an engineering stage needs a decision, it returns one question and recommendation. A separate Product Owner agent answers the actual question. The same PO session handles every question in the run, so later answers retain earlier decisions and remain coherent across every stage.

The PO receives the feature request, the case's `product-brief.md`, and the questions. It does not receive the rubric or candidate diff. The brief supplies stable product facts without predicting which questions will be asked or scripting their answers. The PO's standing policy is to preserve those facts, choose the smallest coherent product scope where the brief is silent, and leave implementation mechanics to engineering.

Every question and answer is recorded in the run artifact.

## Direct Target Operation

The harness requires the target to be:

- the repository root
- on `main`
- clean, including untracked files
- different from this control repository

Before mutation, it records the original commit and copies any existing `backlog/` and `.boris/` directories to a temporary backup. It then runs directly in the target.

The engineering sessions load normal Claude Code customizations. The harness does not use `--safe-mode`, disable slash commands, restrict MCP configuration, replace the project system prompt, or reduce the environment. It invokes the native skills and uses `--dangerously-skip-permissions` so permission prompts cannot stall an autonomous run.

This is intentionally less isolated than a disposable benchmark. Run it only against the designated template repository with a clean worktree.

## Target Setup

The harness initializes a Backlog.md board when the target does not have one. It creates a feature card from the case's `backlog-seed.md` in the pipeline's first declared column and configures the board with the pipeline's `statuses`. The default pipeline declares:

```text
To Do, Shape, Build, Review, Ship, Done
```

It writes the control repository's `CLAUDE.md` into the target and commits that tracked instruction change before the workflow starts. Backlog.md and Boris artifacts remain personal workflow state and are carried between fresh sessions.

After every planning stage, the harness verifies that the target is still on its branch with a clean worktree and that history only advanced, never rewrote, what the stage started from. A planning stage may commit workflow artifacts, a glossary or a document; those commits become part of the stage's judged evidence and advance the baseline the next stage starts from. The harness also verifies that the stage wrote acceptance criteria when its definition requires them, and attached its durable document when its definition declares an artifact.

Build must create at least one conventional commit directly on `main`, leave a clean worktree, and preserve descendant history from the baseline the last accepted stage left. The build Judge sees the delivery stage's own commits; the final Judge sees the whole candidate since task setup.

## Stage Grading

Every stage names a rubric under its case's `rubrics/`. Executing agents never receive these rubrics. Each rubric defines:

- hard blockers whose presence makes the stage grade `F`
- binary requirements that cap the grade at `C` when any are missing
- quality dimensions graded `A` through `F`

When no blocker or requirement fails, the worst quality-dimension grade becomes the stage grade. The harness never averages dimensions: excellence in one area cannot compensate for a material weakness in another. Only `A` and `B` continue the workflow.

Planning-stage Judges receive the task, product brief, project instructions, frozen tracked repository files except `bun.lock` (binary files and files beyond the capture limits in `src/benchmark/config.ts` are skipped so judge prompts stay bounded), the stage's structured questions, decisions, and completion summary, Backlog task state, current stage artifact, and all previously accepted artifacts. The Build Judge receives those inputs plus the implementation diff and authoritative local checks. Harness-detected delivery and Build-check failures force a hard blocker regardless of the model's assessment. This records where quality first degraded instead of discovering only that the final implementation failed.

Every stage scorecard stores the frozen input, full rubric, structured source citations, derived grade, original Judge prompt, each returned payload with its per-call cost and validation outcome, and aggregate Judge cost. Citations must resolve to the frozen input. When returned output fails schema, evidence, or grade validation, the Judge receives the rejection and one correction attempt against the same frozen input and rubric. Invocation and Claude-envelope failures are not retried. A failed grade stops subsequent workflow stages and enters human calibration against that exact stage input. A malformed stage delivery follows the same scorecard and calibration path instead of bypassing grading.

## Final Grading

After delivery validation, the harness reruns the pipeline's target checks in declaration order. Each check is an argument-vector command with an optional environment overlay. The default pipeline is this example:

```sh
CONFIG_PATH=src/config/test.yaml bun run typecheck
CONFIG_PATH=src/config/test.yaml bun run check
CONFIG_PATH=src/config/test.yaml bun run test:unit
```

The harness also compares every pipeline-declared check-integrity file with its baseline bytes. The default pipeline protects `package.json`, `tsconfig.json`, and `biome.json`. A missing baseline file is a configuration error, and a changed or deleted declared file fails check integrity, so the candidate cannot obtain a passing result by weakening the configured checks.

After every stage has passed, the final Judge runs separately in safe mode with no tools. It receives only:

- the external rubric
- frozen tracked baseline files except `bun.lock`
- the implementation diff, with binary changes summarized
- measured check results
- measured check-integrity results

Judge output is schema-validated. Every rubric ID must appear exactly once, evidence must cite supplied material, and PASS requires every requirement to pass. Output rejected by those validations receives one correction attempt against the same frozen candidate evidence and rubric; invocation and Claude-envelope failures are not retried. The harness replaces the Judge's `check-integrity` and `local-checks` conclusions with authoritative local results.

Human acceptance remains the final calibration standard. Passing stage grades and a final Judge PASS do not overrule a problem found during review.

## Human Calibration

After grading, the implementation remains in the real target repository. The harness writes a preliminary run artifact with status `AWAITING_HUMAN_REVIEW`, creates a neighboring `<timestamp>.review.json`, prints both paths, and waits.

Use this pause to inspect commits, code, tests, architecture, and the structured grade. Record the human verdict and findings in the review file:

```json
{
	"verdict": "REJECT",
	"summary": "The worker drops request metadata.",
	"findings": [
		{
			"description": "The persisted row omits request metadata.",
			"paths": ["src/audit/worker/audit.worker.ts"],
			"stage": "build",
			"judgeAssessment": "MISSED",
			"rubricId": "worker-metadata"
		}
	]
}
```

Each finding has one Judge assessment:

- `CAUGHT`: the original Judge already failed the cited rubric ID.
- `MISSED`: the candidate has a real defect the original Judge passed or did not cover.
- `FALSE_POSITIVE`: the original Judge failed a correct implementation because the rubric was wrong or ambiguous.
- `NOT_PROMOTED`: record the observation, but do not turn it into a reusable Judge rule.

`stage` names the pipeline stage the finding belongs to, or `final` for the final Judge; omitted values default to `final` for compatibility with existing review files. `CAUGHT`, `MISSED`, and `FALSE_POSITIVE` findings require a `rubricId`. Human acceptance cannot contain a `CAUGHT` or `MISSED` defect.

If the work reveals an agent-behavior problem, edit `CLAUDE.md`. For a stage-specific `MISSED` or `FALSE_POSITIVE`, edit the corresponding file under the case's `rubrics/`; for a final finding, edit the case's `rubric.md`. During a stage-failure pause no final grade exists yet, so a `rubric.md` edit is recorded in the calibration result but rejudged only by a run that reaches final grading. Press Enter when the review and control-file edits are ready.

When a stage rubric changes, the harness regrades the exact same transcript and frozen stage artifacts. When `rubric.md` changes, it runs the final Judge again against the exact same candidate diff, baseline context, and local-check results. Calibration succeeds only when:

- every `CAUGHT` finding maps to an original failing requirement
- every `MISSED` finding maps to a revised failing requirement
- every `FALSE_POSITIVE` maps from an original failure to a revised pass
- you confirm that the revised result reaches those conclusions for the right reasons

Invalid review JSON, inconsistent findings, malformed rubric IDs, an ineffective rubric revision, or a rejected rejudge result leaves the target in place and returns to the review prompt. This makes the flawed candidate the regression fixture for the new Judge rule instead of waiting for another implementation run.

After successful calibration, the harness updates the run artifact to `COMPLETE` with the human review, changed instruction or rubric content, and revised Judge result. It then restores the target. Changes made to this control repository during review are retained and must be committed before the next run.

Completed calibration also updates the Judge agreement snapshot. Every original
rubric criterion contributes one binary Judge/human decision: `CAUGHT` is
fail/fail, `MISSED` is pass/fail, and `FALSE_POSITIVE` is fail/pass. Because the
review must record every finding, a criterion with no Judge-related finding keeps
the original decision as the human decision; `NOT_PROMOTED` does not alter one.
Stage dimensions reduce A/B to pass and C/D/F to fail.

Agreement baselines never merge different exact Judge model identifiers, stages,
or frozen rubric contracts. The contract is identified by SHA-256, so either a
Judge-model change or a rubric edit starts a new baseline even when criterion IDs
stay the same. Each criterion reports sample size, the four pass/fail contingency
counts, observed agreement, and Cohen's kappa. Kappa is `null` when expected
agreement is 1 and its denominator is therefore zero; the counts and observed
agreement remain usable.

The snapshot is stored in completed stopped-stage and final run artifacts and is
also shown in stage/pipeline confirmation reports. Comparison reports use strict
schema version 2 and include snapshots for every exact Judge model represented by
their source groups; version-1 comparison reports remain readable. Current stage
artifacts record `judgeModel` directly. Historical calibrated stage artifacts are
attributed only through their neighboring run manifest; pre-manifest evidence is
not guessed and increments `skippedCalibrations`.

## Restoration

Normal cleanup performs these operations in the target:

```sh
git switch --force main
git reset --hard <original-sha>
git clean -fd
```

It then replaces `backlog/` and `.boris/` with their pre-run copies, verifies that `main` is clean at the original commit, and removes the run marker the harness wrote to the target's `.git/benchmark-run.json` before the first mutation. The workflow backup is deleted only after that verification succeeds; when restoration fails, the backup stays in place and its path is printed.

This removes the temporary instruction commit, all candidate commits, tracked modifications, and ordinary untracked files. Git-ignored dependency and build directories outside the workflow paths are not byte-for-byte snapshotted.

SIGINT, SIGTERM, and SIGHUP kill the harness's child process groups and run this same restoration before the process exits. If the process dies without it, for example under SIGKILL, the run marker stays behind and the next run refuses the target with recovery instructions: first kill any surviving agent processes (children run detached in their own process groups, so they outlive the harness), then restore Git manually with the original SHA printed at startup, then delete the marker. The workflow backup remains under the system temporary directory with a `rehearsal-workflow-backup-` prefix until a successful restoration removes it.

## Inputs

### `CLAUDE.md`

The instruction corpus being tuned. Change it only in response to observed behavior. Keep the task, product brief, rubric, models, and target baseline stable when comparing instruction revisions.

### `cases/<id>/case.json`

The case declaration: the case's id (which must equal its directory name), its
kind, its title, and the inputs that kind needs. It is parsed once at load, and
a path that leaves the case directory is refused there rather than followed.

A `pipeline` case declares the case-relative paths of its task, product brief,
final rubric, pipeline, and stage rubrics, and the target repository it was
written against.

A `session` case declares one Claude session instead of a stage graph: an
optional `fixture` tree to seed the attempt directory from, the `prompt`, an
optional `transcript` prefix to resume, the `tools` the session may use, an
optional `settings` and `agents` overlay passed to the provider as inline JSON,
the `corpusFiles` it reads in corpus layout paths, and the `checks` that judge
it. `cases/smoke/` is the smallest one.

A fixture tree may hold no symlink. A recursive copy preserves one, which would
give the session a live path out of the attempt directory the harness owns, so
a fixture containing one is refused before any provider call, naming the entry.

### Session case check kinds

A session case's judge is a deterministic check list, evaluated over the reply
and the transcript with no provider call. The rep is successful when and only
when every check passes.

A session that terminates without producing a reply, having run out of turns or
budget, records the outcome `NO_REPLY` with no reply and no check evaluated. It
is not a reply of zero words, so it neither passes nor fails the checks: the
record says the measurement did not happen rather than that it succeeded.

- `word-band { min?, max? }` counts the reply's words and reports the count
  against the band.
- `forbidden-text { strings }` fails naming each declared string the reply
  contains. The strings are case data: an em dash and a backtick are declared
  by the case that cares about them, never built into the check.
- `tool-calls { min?, max?, names? }` counts the transcript's `tool_use`
  records and fails on a count outside the band or a tool outside `names`.
- `files-read { paths }` fails naming each declared path that is not the
  `file_path` of a `Read` call in the transcript.

### Corpus layout paths

A session case names the corpus files it reads so that an edit to one makes a
prior attempt stale. The paths are layout paths, not install paths: `CLAUDE.md`
is the control root's project instructions, and `output-styles/<name>.md`,
`agents/<name>.md`, and `skills/<name>/...` resolve under `~/.claude/`. A
declared file that does not resolve is refused before any provider call.

### `.benchmark-runs/cases/<id>/`

A session case's transcript prefixes, captured by `rehearsal case capture`.
The bytes are git-ignored and hashed into lineage; only the declaration, with
the prefix's digest, source session, and cut, is committed.

### `cases/<id>/backlog-seed.md`

The rough product request. It must start with one level-one heading followed by a non-empty description. The first planning stage turns it into acceptance criteria through dynamic PO questions.

### `cases/<id>/product-brief.md`

Stable product facts known by the simulated PO. This is not a question-and-answer script: the PO still receives and answers the actual questions generated during each run. Keep this file fixed while comparing instruction revisions.

### `cases/<id>/rubric.md`

The independent acceptance criteria. Requirements use this format:

```text
1. `requirement-id`: Binary requirement text.
```

IDs are parsed at runtime, so adding a newly discovered requirement does not require a TypeScript change. IDs must be unique. The rubric must retain `check-integrity` and `local-checks` because those are owned by measured harness results.

### `cases/<id>/rubrics/*.json`

The independent process-quality contracts the pipeline's stages adopt. IDs must be unique within each file. Add a hard blocker only when its presence invalidates the stage output, add a requirement when every acceptable output must satisfy it, and use a quality dimension when the result can be valid at different levels of quality. Human calibration regrades the same frozen stage input after one of these files changes.

### `rehearsal.ts`

The CLI entry point. It validates the Bun version, dispatches on the command name, generates help from the command's flag declaration, and maps each failure to the exit code its error type carries.

### `src/cli/`

One module per command, holding the wiring that turns parsed flags into a harness call: the flag and exit-code declarations, the terminal-stdin gate, and the writers that keep records on stdout and diagnostics on stderr. It depends on the harness; the harness does not depend on it.

### `src/benchmark/`

The harness implementation, separated by responsibility: Backlog state, calibration, checks, Claude session invocation, command execution, configuration, validated contracts, final judging, orchestration, stage grading, target Git lifecycle, and workflow sessions. Every Claude session builds its command line and parses its response envelope through `claude.ts`; expensive Claude calls live in `workflow.ts`, `stage-grading.ts`, and `judge.ts`; local stage-artifact verification lives in `backlog.ts` and can be tested without invoking them.

### `src/benchmark/*.test.ts`

Unit and filesystem integration tests for configuration parsing, stage and final rubric validation, non-compensating grade derivation, native-skill invocation, stage order, artifact resolution, direct-target restoration, preserved workflow state, commit rules, check integrity, and Judge evidence.

## Prerequisites

- Bun `1.4.0`
- authenticated `claude` CLI
- the skills the selected pipeline names (the default needs `/shape` and `/build`)
- installed `backlog` CLI
- target dependencies already installed
- clean, committed control repository
- clean target repository on `main`
- enough budget for one engineering session per pipeline stage, the shared PO, up to two calls for each stage or final Judge when output validation requires correction, and any calibration rejudges

The `audit-log` case declares `/Users/joaofnds/code/nest/template` as its target, so a run needs no `--target`. Point a run at another checkout with `--target` or `BENCHMARK_TARGET_DIR`.

## Running

The toolchain is pinned in `mise.toml`: Bun, the `claude` CLI, and `backlog`. Install it with `mise install`. The harness refuses to start on a Bun other than the pinned one, and records the `claude` version in every run artifact, because the agent is part of what a run measures and a floating version makes two runs incomparable.

```sh
mise install
bun install --frozen-lockfile
bun run typecheck
bun run fmt:check
bun run lint
bun test

bun run rehearsal case list
bun run rehearsal case show audit-log --json

bun run rehearsal run \
  --case audit-log \
  --model sonnet \
  --effort high \
  --session-budget-usd 10

bun run rehearsal run \
  --case smoke \
  --model haiku \
  --effort low \
  --session-budget-usd 0.2

bun run rehearsal run \
  --case smoke \
  --corpus ~/variants/brief-rewrite \
  --model haiku \
  --effort low \
  --session-budget-usd 0.2

bun run rehearsal case capture <case-id> \
  --session <session-id-or-prefix> \
  --cut <index>
```

`--case` names a declared case under `cases/` and defaults to `audit-log`. A
session case takes neither `--target` nor `--pipeline`; naming either is a
usage error rather than a flag that quietly does nothing.

`--corpus` names the corpus under test: a directory already in corpus layout
(`CLAUDE.md`, `skills/<name>/`, `output-styles/<name>.md`, `agents/<name>.md`),
or `chezmoi:<ref>`, the chezmoi source at that git ref rendered into a scratch
destination the run deletes afterwards. Absent `--corpus` the corpus is the live
install, exactly as before. Either way the source is resolved and snapshotted
before any provider call, and the snapshot is the only place the bytes are read
from for hashing and for delivery, so a run against a moving source cannot
record one corpus and read another.

What is snapshotted, delivered, and selected is what the case declared in its
`corpusFiles`, never everything the source happens to hold: a source carrying a
second output style does not change which style the attempt runs against. A
declared entry that is a symlink, or a declared directory holding one, is
refused naming the entry, because a copy would follow it and snapshot bytes from
outside the source while the record said otherwise.

The variant reaches the session as project-level files under the attempt
directory the harness owns and deletes, which shadow the same-named user-level
ones. Nothing installed moves and no running session is affected, and because
the session still runs with the live configuration its hooks, memory, and MCP
are the real ones. A skill cannot be delivered this way on claude 2.1.258: a
project-level skill does not shadow a user-level one, so a case that declares a
skill as a corpus file is refused naming ACT-28, and `--corpus` on a pipeline
case or a stage replay, whose corpus is its skills, is refused for the same
reason.

`rehearsal case capture` freezes a real session file as a case's transcript
prefix: it copies lines `[0, cut)` of the source session into the case's
transcript store, records the digest, the source session, and the cut in the
declaration, and prints the updated declaration. `--session` takes a session id
or a unique prefix of one, and the source is read as a stream rather than held
in memory, because transcripts run to several megabytes.

The case supplies the task, product brief, final rubric, stage rubrics,
pipeline, and the target repository it was written against; `--target` and
`BENCHMARK_TARGET_DIR` override that declared target, and `--pipeline` overrides
the declared pipeline. An unknown case is refused with exit 3 before the target
is claimed.

Equivalent environment variables are available:

```sh
export BENCHMARK_CASE=audit-log
export BENCHMARK_TARGET_DIR=/Users/joaofnds/code/nest/template
export BENCHMARK_MODEL=sonnet
export BENCHMARK_EFFORT=high
export BENCHMARK_SESSION_BUDGET_USD=10
bun run rehearsal run
```

Replay re-runs one stage of a recorded run against the current corpus, in a
fresh worktree, sharing the same session knobs and their environment
fallbacks:

```sh
bun run rehearsal replay \
  --run 2026-08-30T10-00-00.000Z \
  --stage build \
  --model sonnet \
  --session-budget-usd 10
```

`rehearsal` is one executable with three commands: `run`, `replay`, and
`compare`. `rehearsal --help` lists them; `rehearsal <command> --help` prints
that command's flags with each default and environment variable, generated
from the command's own flag declaration. Every command accepts `--json`,
which prints on stdout the exact record the command wrote, parsed by the
schema that wrote it; without `--json` it prints that record's path.

The rule stdout aims at is that stdout carries data only and stderr everything
else, so a caller can pipe one into a parser and read the other as
diagnostics. `compare` honors it today: its stdout is the report and nothing
else. `run` and `replay` do not yet. Both still print harness progress on
stdout, so `rehearsal run --json > artifact.json` writes a file that is not
parseable JSON. ACT-26.7 moves that progress to stderr; until it lands, parse
`run` and `replay` output from the record file whose path the command prints.

Exit codes have one meaning each:

```text
0  the command completed and wrote its record, whatever the grade
1  execution failure
2  usage error: an unknown flag, a missing required flag, an unparseable value
3  refused precondition: an approval whose flag is absent while stdin is not a
   TTY, or a run that cannot be replayed
```

A failing grade is evidence, not an error, so it exits 0.

No prompt exists without a flag that answers it, and a command refuses before
any paid work rather than blocking on a prompt it cannot receive. `run`
refuses when stdin is not a terminal, because the calibration pause has no
flag alternative yet; `replay --confirm` refuses without `--yes` when stdin
is not a terminal, before it resolves the run directory or projects a cost.

`--pipeline` selects the pipeline definition and defaults to the one the case declares. It is read and validated before the target is claimed, so a malformed definition cannot leave a target dirty.

`--model` and `--effort` apply to every engineering stage and the shared PO. Judge defaults to `opus`, except that an Opus workflow defaults Judge to `sonnet`; this recognizes both native aliases and full Claude model IDs. An unrecognized workflow model also defaults Judge to `opus`.

Override the model default with `BENCHMARK_JUDGE_MODEL` or `--judge-model`; the CLI flag wins when both are present. An explicit Judge in the same recognized model family as the workflow, or with the same unrecognized identifier, is allowed but prints a self-preference warning to stderr. Judge effort defaults to workflow effort and can be overridden with `BENCHMARK_JUDGE_EFFORT` or `--judge-effort`.

Native Claude model aliases such as `sonnet` and `opus` are accepted. Use a full model ID only when a comparison must remain pinned to one exact model release. Supported effort values are `low`, `medium`, `high`, `xhigh`, and `max`.

The session budget is enforced independently for each engineering stage, across the shared PO session, and for Judge.

## Run Artifacts

Completed runs are written to:

```text
.benchmark-runs/<ISO timestamp>.json
.benchmark-runs/<ISO timestamp>.<stage>.json
.benchmark-runs/<ISO timestamp>.checkpoints/<stage>/
```

Each stage file first records the frozen Judge input, so a Judge timeout or invalid response does not erase the stage evidence. A successful Judge replaces that preliminary record with the scorecard, including every Judge attempt and including when the grade stops the workflow. Successful end-to-end runs also include all stage scorecards in the main artifact.

Each checkpoint directory freezes the state the next stage consumed, written the moment the stage's Judge accepts, so a run that fails at a later stage keeps every accepted checkpoint for replay. It holds a `checkpoint.json` record — target SHA, per-file hashes, the corpus files that fed the stage, and the lineage key chaining back to the run's initial state — beside a byte-faithful copy of the workflow state (`backlog/`, `.boris/`).

The directory is ignored by Git. Each artifact records:

- control, source, setup, and result commit SHAs
- source path and origin
- requested models, effort levels, budgets, Bun version, and Claude version
- task, product brief, instructions, rubric, and parsed rubric IDs
- the pipeline definition the run executed and the path it was loaded from
- each workflow session ID, the PO session ID, costs, questions, answers, and completion summaries
- each stage rubric, frozen Judge input, prompt, returned Judge attempts, aggregate cost, evidence, grade, and stop decision
- each accepted stage's checkpoint record with its lineage key
- final Backlog.md task state
- baseline context supplied to Judge
- complete implementation diff
- measured checks and check integrity
- original final Judge prompt, returned attempts, aggregate cost, and structured grade
- human verdict and classified findings
- changed instruction and rubric contents
- revised Judge prompt and grade when the rubric changed
- human confirmation of the revised Judge reasoning

The preliminary artifact is written after a valid original Judge result and before human review. Successful calibration updates the same file rather than creating a disconnected result. If both returned final Judge payloads fail harness validation, the harness instead writes a `FAILED` main artifact without a grade; it retains the completed workflow, stage scorecards, frozen candidate evidence, original prompt, both payloads, both validation errors, per-call costs, and aggregate cost. A run that aborts after the preliminary artifact rewrites it with status `FAILED`. A stage Judge failure rewrites its stage file as `STAGE_JUDGE_FAILED`; an exhausted output-validation retry retains the original prompt and both attempts in addition to the error and frozen input. Invocation and Claude-envelope failures retain the earlier one-call failure records. A run that fails earlier preserves terminal output and pauses for inspection before restoration.

## Reading the Records

`list`, `show`, and `stale` read what is on disk. None of them starts a
provider session or a worktree, and none of them writes anything.

```sh
bun run rehearsal list <cases|runs|checkpoints|attempts|groups|comparisons>
bun run rehearsal show <record-id> [--json]
bun run rehearsal stale [--corpus <source>] [--model <model>] [--effort <effort>]
```

Every id `list` prints is one `show` accepts back as an argument:

| kind               | id                                    |
| ------------------ | ------------------------------------- |
| case               | `case:<id>`                           |
| run                | `run:<name>`                          |
| checkpoint         | `checkpoint:<run>/<stage>`            |
| session attempt    | `attempt:session:<case>/<uuid>`       |
| stage replay       | `attempt:stage:<lineage>/<timestamp>` |
| confirmation group | `group:<group-id>`                    |
| comparison         | `comparison:<manifest-digest>`        |

The two attempt forms name their kind because the two carry different
identities on disk: a session attempt is a case and the uuid of the directory
the harness created for it, and a stage replay is the lineage it consumed and
the timestamp it ran at. Both are two segments, so without the kind in the id
`show` would have to guess from the shape of the first one.

`list` prints one tab-separated line per record on stdout. A record it cannot
read is named on stderr with the reason while every record that parses still
prints, and the command still exits 0: one half-written group must not hide
the groups beside it.

`show <id> --json` prints the bytes of the one record file the id names, so a
caller pipes it straight into a parser. Without `--json`, a run, a group, and a
comparison print a short markdown summary a session can paste onto a card — a
run's stages with their grades and its total cost, a group's success rate,
standard error, and pass^k with its cost, and a comparison's paired deltas
beside the contrast against the control arm. Every other kind prints its own
bytes. The summaries are pure functions of the parsed record: no clock and no
second record shape.

`stale` names every checkpoint and session case whose recorded corpus digests
the current corpus no longer matches, each with the files that differ. It
hashes the corpus and never installs it, which is why it needs no worktree and
why it accepts `--corpus` where `run` and `replay` refuse one. A session case
with no recorded attempt is not stale: staleness claims a prior measurement no
longer describes the corpus, and with no measurement there is nothing to
invalidate.

A checkpoint also goes stale on the model and the effort, so `stale` reads
`--model` and `--effort` with the same environment fallbacks `replay` reads
them by: they name what a replay would use, and every recorded checkpoint is
compared against them. Naming neither asserts neither, and the answer covers
the corpus half alone — a checkpoint compared against the manifest that
produced it can never differ. `BENCHMARK_MODEL=opus rehearsal stale` reports
what `replay --model opus` would log as stale.

Exit codes follow the table in `rehearsal --help`: `2` for an unknown list kind
or a malformed id, `3` for a well-formed id naming no record and for a
`--corpus` source that does not resolve.

## Comparing Confirmation Groups

Comparison reporting reads completed confirmation evidence and never starts a provider session or worktree. Give it a versioned manifest with at least two benchmark cases. Paths are relative to the manifest, and every case has exactly the baseline, candidate, and user-provided minimal-corpus control arms:

```json
{
	"schemaVersion": 1,
	"cases": [
		{
			"caseId": "case-1",
			"arms": {
				"baseline": "groups/case-1-baseline/group.json",
				"candidate": "groups/case-1-candidate/group.json",
				"control": "groups/case-1-control/group.json"
			}
		},
		{
			"caseId": "case-2",
			"arms": {
				"baseline": "groups/case-2-baseline/group.json",
				"candidate": "groups/case-2-candidate/group.json",
				"control": "groups/case-2-control/group.json"
			}
		}
	]
}
```

```sh
bun run rehearsal compare path/to/comparison.json
```

The command validates and hashes the manifest, source groups, reps, and frozen inputs before creating anything. It recomputes quality and resource statistics from rep records rather than trusting confirmation `report.json` files, then prints the deterministic report path:

```text
.benchmark-runs/comparisons/<manifest-sha256>/report.json
```

`bun run rehearsal compare path/to/comparison.json --json` prints the report's
own bytes on stdout instead of its path, so a caller can pipe it straight into
a parser. It starts no provider session either way, and exits 0 once the report
is written.

## Tuning Loop

1. Commit a clean control state.
2. Run the benchmark against the same target SHA, model selections, and effort levels.
3. Inspect the actual target implementation during the review pause.
4. Record the human verdict and classify every finding against the original Judge result.
5. Update `CLAUDE.md` for behavior failures.
6. Update the responsible stage rubric, or the case's `rubric.md` for final-product findings, when the Judge missed a defect or produced a false positive.
7. Press Enter to rejudge the same candidate and validate the revised rubric.
8. Correct ineffective rubric changes until calibration passes.
9. Let the harness record calibration and restore the target.
10. Commit control changes.
11. Run again and compare completed artifacts.

The benchmark is ready for unattended end-to-end use only after repeated runs produce work that satisfies both the external rubric and human production standards.
