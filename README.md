# Template Agent Benchmark

This repository controls an authentic rehearsal of the development workflow used in the NestJS template. It gives a known task to Claude Code, lets the installed workflow skills produce and execute the work, grades the committed result, pauses for human calibration, and restores the target repository.

The benchmark runs directly in the target repository on `main`. It does not use a clone, branch, or worktree. That is deliberate: the goal is to measure behavior in the same repository, path, instruction hierarchy, settings, skills, hooks, memories, and tool environment used for real work.

## What The Benchmark Measures

The benchmark tests whether the current instruction corpus and workflow can turn a rough backlog item into production-quality committed code with almost no human intervention.

One run uses:

```text
template-ops/CLAUDE.md       project instructions under evaluation
template-ops/backlog-seed.md known feature request
template-ops/product-brief.md stable product facts available to the PO
template-ops/rubric.md       external binary acceptance rubric
target repository            real application and real main branch
installed Claude skills      discuss, grill, plan, and build
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
fresh /discuss session <-> dynamic Product Owner
        |
        v
fresh /grill session   <-> same Product Owner
        |
        v
fresh /plan session    <-> same Product Owner
        |
        v
fresh /build session   <-> same Product Owner
        |
        v
verify commits, clean worktree, checks, and check integrity
        |
        v
independent Judge applies the external rubric
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

The installed skills currently require Grill before Plan: Grill hardens the approach, Plan writes that ratified approach for a cold Build session, and Build consumes the plan. Running Plan before Grill would leave Build with a stale plan.

Each engineering stage starts a distinct Claude session. A stage may take multiple turns when it needs product input, but no stage inherits another stage's conversation. Durable Backlog.md documents carry the work forward instead.

## Dynamic Product Owner

There is no predetermined answer file.

When an engineering stage needs a decision, it returns one question and recommendation. A separate Product Owner agent answers the actual question. The same PO session handles every question in the run, so later answers retain earlier decisions and remain coherent across Discuss, Grill, Plan, and Build.

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

The harness initializes a Backlog.md board when the target does not have one. It creates a feature card from `backlog-seed.md` and configures these workflow columns:

```text
To Do, Spec, Grill, Plan, Build, Done
```

It writes the control repository's `CLAUDE.md` into the target and commits that tracked instruction change before the workflow starts. Backlog.md and Boris artifacts remain personal workflow state and are carried between fresh sessions.

After Discuss, Grill, and Plan, the harness verifies that application Git history and tracked files are still unchanged. It also verifies that:

- Discuss wrote acceptance criteria and attached a spec document.
- Grill attached a grilled-design document.
- Plan attached a plan document.

Build must create at least one conventional commit directly on `main`, leave a clean worktree, and preserve descendant history from the task setup commit.

## Grading

After Build, the harness reruns:

```sh
bun run typecheck
bun run check
CONFIG_PATH=src/config/test.yaml bun run test:unit
```

It also compares hashes for `package.json`, `tsconfig.json`, and `biome.json`. The candidate cannot obtain a passing result by weakening the configured checks.

The Judge runs separately in safe mode with no tools. It receives only:

- the external rubric
- selected baseline files showing existing project patterns
- the complete implementation diff
- measured check results
- measured check-integrity results

Judge output is schema-validated. Every rubric ID must appear exactly once, evidence must cite supplied material, and PASS requires every requirement to pass. The harness replaces the Judge's `check-integrity` and `local-checks` conclusions with authoritative local results.

Human acceptance remains the final calibration standard. A Judge PASS does not overrule a problem found during review.

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

`CAUGHT`, `MISSED`, and `FALSE_POSITIVE` findings require a `rubricId`. Human acceptance cannot contain a `CAUGHT` or `MISSED` defect.

If the work reveals an agent-behavior problem, edit `CLAUDE.md`. For a `MISSED` or `FALSE_POSITIVE` finding, edit `rubric.md` before continuing. Press Enter when the review and control-file edits are ready.

When `rubric.md` changed, the harness runs Judge again against the exact same candidate diff, baseline context, and local-check results. Calibration succeeds only when:

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

It then replaces `backlog/` and `.boris/` with their pre-run copies and verifies that `main` is clean at the original commit.

This removes the temporary instruction commit, all candidate commits, tracked modifications, and ordinary untracked files. Git-ignored dependency and build directories outside the workflow paths are not byte-for-byte snapshotted.

If the process is forcibly killed before its `finally` cleanup runs, use the original SHA printed at startup to restore Git manually. The workflow backup remains under the system temporary directory with a `template-workflow-backup-` prefix until normal cleanup removes it.

## Inputs

### `CLAUDE.md`

The instruction corpus being tuned. Change it only in response to observed behavior. Keep the task, product brief, rubric, models, and target baseline stable when comparing instruction revisions.

### `backlog-seed.md`

The rough product request. It must start with one level-one heading followed by a non-empty description. Discuss turns it into a spec and acceptance criteria through dynamic PO questions.

### `product-brief.md`

Stable product facts known by the simulated PO. This is not a question-and-answer script: the PO still receives and answers the actual questions generated during each run. Keep this file fixed while comparing instruction revisions.

### `rubric.md`

The independent acceptance criteria. Requirements use this format:

```text
1. `requirement-id`: Binary requirement text.
```

IDs are parsed at runtime, so adding a newly discovered requirement does not require a TypeScript change. IDs must be unique. The rubric must retain `check-integrity` and `local-checks` because those are owned by measured harness results.

### `run_benchmark.ts`

The orchestration program. It owns preflight, target restoration, Backlog.md setup, fresh skill sessions, PO mediation, checks, grading, artifacts, and the human-review pause.

### `run_benchmark.test.ts`

Unit and filesystem integration tests for configuration parsing, rubric validation, native-skill invocation, stage order, direct-target restoration, preserved workflow state, commit rules, check integrity, and Judge evidence.

## Prerequisites

- Bun `1.4.0`
- authenticated `claude` CLI
- installed `/discuss`, `/grill`, `/plan`, and `/build` skills
- installed `backlog` CLI
- target dependencies already installed
- clean, committed control repository
- clean target repository on `main`
- enough budget for six independent allocations, plus a seventh Judge allocation when calibration changes the rubric

Set the target to `/Users/joaofnds/code/nest/template` through `--target` or `BENCHMARK_TARGET_DIR`.

## Running

```sh
bun install --frozen-lockfile
bun run typecheck
bun run check
bun test

bun run benchmark \
  --target /Users/joaofnds/code/nest/template \
  --model sonnet \
  --effort high \
  --session-budget-usd 10
```

Equivalent environment variables are available:

```sh
export BENCHMARK_TARGET_DIR=/Users/joaofnds/code/nest/template
export BENCHMARK_MODEL=sonnet
export BENCHMARK_EFFORT=high
export BENCHMARK_SESSION_BUDGET_USD=10
bun run benchmark
```

`--model` and `--effort` apply to Discuss, Grill, Plan, Build, and the shared PO. Judge defaults to the same values. Override it with `--judge-model` and `--judge-effort`, or `BENCHMARK_JUDGE_MODEL` and `BENCHMARK_JUDGE_EFFORT`.

Native Claude model aliases such as `sonnet` and `opus` are accepted. Use a full model ID only when a comparison must remain pinned to one exact model release. Supported effort values are `low`, `medium`, `high`, `xhigh`, and `max`.

The session budget is enforced independently for each engineering stage, across the shared PO session, and for Judge.

## Run Artifacts

Completed runs are written to:

```text
.benchmark-runs/<ISO timestamp>.json
```

The directory is ignored by Git. Each artifact records:

- control, source, setup, and result commit SHAs
- source path and origin
- requested models, effort levels, budgets, Bun version, and Claude version
- task, product brief, instructions, rubric, and parsed rubric IDs
- each workflow session ID, the PO session ID, costs, questions, answers, and completion summaries
- final Backlog.md task state
- baseline context supplied to Judge
- complete implementation diff
- measured checks and check integrity
- original Judge prompt and structured grade
- human verdict and classified findings
- changed instruction and rubric contents
- revised Judge prompt and grade when the rubric changed
- human confirmation of the revised Judge reasoning

The preliminary artifact is written after a valid original Judge result and before human review. Successful calibration updates the same file rather than creating a disconnected result. A run that fails earlier preserves terminal output and pauses for inspection before restoration.

## Tuning Loop

1. Commit a clean control state.
2. Run the benchmark against the same target SHA, model selections, and effort levels.
3. Inspect the actual target implementation during the review pause.
4. Record the human verdict and classify every finding against the original Judge result.
5. Update `CLAUDE.md` for behavior failures.
6. Update `rubric.md` for missed defects or false positives.
7. Press Enter to rejudge the same candidate and validate the revised rubric.
8. Correct ineffective rubric changes until calibration passes.
9. Let the harness record calibration and restore the target.
10. Commit control changes.
11. Run again and compare completed artifacts.

The benchmark is ready for unattended end-to-end use only after repeated runs produce work that satisfies both the external rubric and human production standards.
