# Rehearsal

This repository controls an authentic rehearsal of the development workflow used in the NestJS template. It gives a known task to Claude Code, lets the installed workflow skills produce and execute the work, grades the committed result, pauses for human calibration, and restores the target repository.

The benchmark runs directly in the target repository on `main`. It does not use a clone, branch, or worktree. That is deliberate: the goal is to measure behavior in the same repository, path, instruction hierarchy, settings, skills, hooks, memories, and tool environment used for real work.

Where this is heading — a stage-replay corpus-tuning tool — is written in [docs/vision.md](docs/vision.md) and [docs/design.md](docs/design.md). Domain terms live in [GLOSSARY.md](GLOSSARY.md).

## What The Benchmark Measures

The benchmark tests whether the current instruction corpus and workflow can turn a rough backlog item into production-quality committed code with almost no human intervention.

One run uses:

```text
rehearsal/CLAUDE.md       project instructions under evaluation
rehearsal/backlog-seed.md known feature request
rehearsal/product-brief.md stable product facts available to the PO
rehearsal/pipelines/*.json the workflow: board columns, stages, skills, rubrics
rehearsal/rubrics/*.json  process-quality rubrics a stage adopts
rehearsal/rubric.md       external binary acceptance rubric
target repository            real application and real main branch
installed Claude skills      whichever skills the pipeline names
```

The executing sessions never receive `rubric.md` and are not told that their work is being graded. Only normal project instructions, backlog artifacts, and Product Owner decisions enter the target workflow.

## Workflow

```text
clean target repository on main
        |
        v
record original SHA and back up backlog/ + .boris/
        |
        v
run baseline typecheck, Biome, and unit tests
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
human review updates CLAUDE.md and/or rubric.md
        |
        v
rejudge the same candidate when rubric.md changed
        |
        v
validate and record calibration
        |
        v
reset main to the original SHA and restore workflow artifacts
```

The pipeline is configuration, not harness code: every user brings their own workflow. A definition, selected with `--pipeline` and defaulting to `pipelines/default.json`, declares the board columns the target's Backlog.md uses, each stage's name, kind, and skill, the rubric its Judge applies, and optionally the durable document a planning stage must attach. A stage that records its output only on the task card declares no artifact. Stages can be added, removed, renamed, or reordered without changing the harness; a pipeline must declare exactly one delivery stage and place it last.

The default pipeline follows the currently installed workflow: a `shape` stage that turns the request into acceptance observations on the card, then a `build` stage that delivers the implementation.

Each engineering stage starts a distinct Claude session. A stage may take multiple turns when it needs product input, but no stage inherits another stage's conversation. Durable Backlog.md documents carry the work forward instead. A separate fresh Judge grades each completed stage before its output can become the next stage's input.

## Dynamic Product Owner

There is no predetermined answer file.

When an engineering stage needs a decision, it returns one question and recommendation. A separate Product Owner agent answers the actual question. The same PO session handles every question in the run, so later answers retain earlier decisions and remain coherent across every stage.

The PO receives the feature request, `product-brief.md`, and the questions. It does not receive the rubric or candidate diff. The brief supplies stable product facts without predicting which questions will be asked or scripting their answers. The PO's standing policy is to preserve those facts, choose the smallest coherent product scope where the brief is silent, and leave implementation mechanics to engineering.

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

The harness initializes a Backlog.md board when the target does not have one. It creates a feature card from `backlog-seed.md` in the pipeline's first declared column and configures the board with the pipeline's `statuses`. The default pipeline declares:

```text
To Do, Shape, Build, Review, Ship, Done
```

It writes the control repository's `CLAUDE.md` into the target and commits that tracked instruction change before the workflow starts. Backlog.md and Boris artifacts remain personal workflow state and are carried between fresh sessions.

After every planning stage, the harness verifies that the target is still on its branch with a clean worktree and that history only advanced, never rewrote, what the stage started from. A planning stage may commit workflow artifacts, a glossary or a document; those commits become part of the stage's judged evidence and advance the baseline the next stage starts from. The harness also verifies that the stage wrote acceptance criteria when its definition requires them, and attached its durable document when its definition declares an artifact.

Build must create at least one conventional commit directly on `main`, leave a clean worktree, and preserve descendant history from the baseline the last accepted stage left. The build Judge sees the delivery stage's own commits; the final Judge sees the whole candidate since task setup.

## Stage Grading

Every stage names a rubric under `rubrics/`. Executing agents never receive these rubrics. Each rubric defines:

- hard blockers whose presence makes the stage grade `F`
- binary requirements that cap the grade at `C` when any are missing
- quality dimensions graded `A` through `F`

When no blocker or requirement fails, the worst quality-dimension grade becomes the stage grade. The harness never averages dimensions: excellence in one area cannot compensate for a material weakness in another. Only `A` and `B` continue the workflow.

Planning-stage Judges receive the task, product brief, project instructions, frozen tracked repository files except `bun.lock` (binary files and files beyond the capture limits in `src/benchmark/config.ts` are skipped so judge prompts stay bounded), the stage's structured questions, decisions, and completion summary, Backlog task state, current stage artifact, and all previously accepted artifacts. The Build Judge receives those inputs plus the implementation diff and authoritative local checks. Harness-detected delivery and Build-check failures force a hard blocker regardless of the model's assessment. This records where quality first degraded instead of discovering only that the final implementation failed.

Every stage scorecard stores the frozen input, full rubric, structured source citations, derived grade, original Judge prompt, each returned payload with its per-call cost and validation outcome, and aggregate Judge cost. Citations must resolve to the frozen input. When returned output fails schema, evidence, or grade validation, the Judge receives the rejection and one correction attempt against the same frozen input and rubric. Invocation and Claude-envelope failures are not retried. A failed grade stops subsequent workflow stages and enters human calibration against that exact stage input. A malformed stage delivery follows the same scorecard and calibration path instead of bypassing grading.

## Final Grading

After Build, the harness reruns:

```sh
bun run typecheck
bun run check
CONFIG_PATH=src/config/test.yaml bun run test:unit
```

It also compares hashes for `package.json`, `tsconfig.json`, and `biome.json`. The candidate cannot obtain a passing result by weakening the configured checks.

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

If the work reveals an agent-behavior problem, edit `CLAUDE.md`. For a stage-specific `MISSED` or `FALSE_POSITIVE`, edit the corresponding file under `rubrics/`; for a final finding, edit `rubric.md`. During a stage-failure pause no final grade exists yet, so a `rubric.md` edit is recorded in the calibration result but rejudged only by a run that reaches final grading. Press Enter when the review and control-file edits are ready.

When a stage rubric changes, the harness regrades the exact same transcript and frozen stage artifacts. When `rubric.md` changes, it runs the final Judge again against the exact same candidate diff, baseline context, and local-check results. Calibration succeeds only when:

- every `CAUGHT` finding maps to an original failing requirement
- every `MISSED` finding maps to a revised failing requirement
- every `FALSE_POSITIVE` maps from an original failure to a revised pass
- you confirm that the revised result reaches those conclusions for the right reasons

Invalid review JSON, inconsistent findings, malformed rubric IDs, an ineffective rubric revision, or a rejected rejudge result leaves the target in place and returns to the review prompt. This makes the flawed candidate the regression fixture for the new Judge rule instead of waiting for another implementation run.

After successful calibration, the harness updates the run artifact to `COMPLETE` with the human review, changed instruction or rubric content, and revised Judge result. It then restores the target. Changes made to this control repository during review are retained and must be committed before the next run.

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

### `backlog-seed.md`

The rough product request. It must start with one level-one heading followed by a non-empty description. The first planning stage turns it into acceptance criteria through dynamic PO questions.

### `product-brief.md`

Stable product facts known by the simulated PO. This is not a question-and-answer script: the PO still receives and answers the actual questions generated during each run. Keep this file fixed while comparing instruction revisions.

### `rubric.md`

The independent acceptance criteria. Requirements use this format:

```text
1. `requirement-id`: Binary requirement text.
```

IDs are parsed at runtime, so adding a newly discovered requirement does not require a TypeScript change. IDs must be unique. The rubric must retain `check-integrity` and `local-checks` because those are owned by measured harness results.

### `rubrics/*.json`

The independent process-quality contracts the pipeline's stages adopt. IDs must be unique within each file. Add a hard blocker only when its presence invalidates the stage output, add a requirement when every acceptable output must satisfy it, and use a quality dimension when the result can be valid at different levels of quality. Human calibration regrades the same frozen stage input after one of these files changes.

### `run-benchmark.ts`

The CLI entry point. It validates the Bun version, parses arguments, creates the terminal question interface, and delegates the run.

### `src/benchmark/`

The harness implementation, separated by responsibility: Backlog state, calibration, checks, Claude session invocation, command execution, configuration, validated contracts, final judging, orchestration, stage grading, target Git lifecycle, and workflow sessions. Every Claude session builds its command line and parses its response envelope through `claude.ts`; expensive Claude calls live in `workflow.ts`, `stage-grading.ts`, and `judge.ts`; local stage-artifact verification lives in `backlog.ts` and can be tested without invoking them.

### `run-benchmark.test.ts`

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

Set the target to `/Users/joaofnds/code/nest/template` through `--target` or `BENCHMARK_TARGET_DIR`.

## Running

The toolchain is pinned in `mise.toml`: Bun, the `claude` CLI, and `backlog`. Install it with `mise install`. The harness refuses to start on a Bun other than the pinned one, and records the `claude` version in every run artifact, because the agent is part of what a run measures and a floating version makes two runs incomparable.

```sh
mise install
bun install --frozen-lockfile
bun run typecheck
bun run fmt:check
bun run lint
bun test

bun run benchmark \
  --target /Users/joaofnds/code/nest/template \
  --model sonnet \
  --effort high \
  --session-budget-usd 10 \
  --pipeline pipelines/default.json
```

Equivalent environment variables are available:

```sh
export BENCHMARK_TARGET_DIR=/Users/joaofnds/code/nest/template
export BENCHMARK_MODEL=sonnet
export BENCHMARK_EFFORT=high
export BENCHMARK_SESSION_BUDGET_USD=10
export BENCHMARK_PIPELINE=pipelines/default.json
bun run benchmark
```

`--pipeline` selects the pipeline definition and defaults to `pipelines/default.json`. It is read and validated before the target is claimed, so a malformed definition cannot leave a target dirty.

`--model` and `--effort` apply to every engineering stage and the shared PO. Judge defaults to the same values. Override it with `--judge-model` and `--judge-effort`, or `BENCHMARK_JUDGE_MODEL` and `BENCHMARK_JUDGE_EFFORT`.

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
bun run compare path/to/comparison.json
```

The command validates and hashes the manifest, source groups, reps, and frozen inputs before creating anything. It recomputes quality and resource statistics from rep records rather than trusting confirmation `report.json` files, then prints the deterministic report path:

```text
.benchmark-runs/comparisons/<manifest-sha256>/report.json
```

## Tuning Loop

1. Commit a clean control state.
2. Run the benchmark against the same target SHA, model selections, and effort levels.
3. Inspect the actual target implementation during the review pause.
4. Record the human verdict and classify every finding against the original Judge result.
5. Update `CLAUDE.md` for behavior failures.
6. Update the responsible stage rubric, or `rubric.md` for final-product findings, when the Judge missed a defect or produced a false positive.
7. Press Enter to rejudge the same candidate and validate the revised rubric.
8. Correct ineffective rubric changes until calibration passes.
9. Let the harness record calibration and restore the target.
10. Commit control changes.
11. Run again and compare completed artifacts.

The benchmark is ready for unattended end-to-end use only after repeated runs produce work that satisfies both the external rubric and human production standards.
