---
id: ACT-38
title: 'run the audit-log pipeline once, end to end, and record what it cost'
status: Done
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-04 02:15'
labels: []
milestone: m-1
dependencies: []
priority: high
ordinal: 40008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The tool has never run its own pipeline. `rehearsal list runs`, `list checkpoints`, `list groups`, and `list comparisons` all return empty on 2026-09-04 at 540ba9a; the only recorded evidence is nine session attempts of the smoke and brief-reply cases. Every capability in docs/design.md's path (pipeline as data, checkpoints, replay, invalidation, reps, comparison reporting) is built and unit-tested, and none has been exercised against a real pipeline.

This card is the first real use. Run `rehearsal run` on the audit-log case against the NestJS template, let it complete or stop, and record what actually happened: the wall-clock, the dollar cost, the stages that passed judgment, and every place the harness surprised the operator.

The point is not a green result. A run that stops at stage two is a successful outcome of this card if what stopped it is recorded. This is the walking skeleton the project never walked, and the unknowns it surfaces are the real backlog for m-1.

Cost is real money and unbudgeted. Ask João for the number before running.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal run` is invoked on the audit-log case and its outcome, complete or stopped, is recorded as a run artifact under .benchmark-runs/runs
- [ ] #2 `rehearsal list runs` returns at least one run, and `rehearsal show` on its id prints the artifact
- [x] #3 The run's wall-clock, dollar cost, and per-stage judge results are recorded on this card
- [x] #4 Every place the harness refused, surprised, or misled the operator during the run is recorded on this card, one line each, as a candidate card
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build, 2026-09-04. Preconditions established before spending anything. Budget approved by João: ~10 USD.

FINDING 1 (before the run, and it would have poisoned it): the target's baseline was red for purely environmental reasons, and the harness gives the operator no warning.

cases/audit-log/pipelines/default.json declares three target checks: `bun run typecheck`, `bun run check`, `bun run test:unit`, all with CONFIG_PATH=src/config/test.yaml. Measured at /Users/joaofnds/code/nest/template, clean on main at 102e39b:

- typecheck: passes.
- check (biome): passes, 99 files.
- test:unit: 15 pass, 1 fail. ECONNREFUSED on 127.0.0.1:5432. Postgres was not running.

The target declares its dependencies in compose.yaml (postgres 18, redis 8). After `docker compose up -d`: redis failed to bind, port 6379 already allocated by something else on this machine, postgres started. test:unit then ran MORE tests and failed MORE of them: 15 pass, 5 fail, all `TableNotFoundException: relation "user" does not exist`, because the database was up but unmigrated.

After `CONFIG_PATH=src/config/test.yaml bun run migrate up`: 20 pass, 0 fail. Baseline is green and the run can start.

Why this matters beyond this run: the harness runs these three checks as the delivery stage's gate. Had the run started twenty minutes earlier, the build stage would have been judged against a target whose tests fail for reasons no agent caused, and the failure would have been attributed to the agent's work. The tool has no baseline precondition check: nothing verifies the target is green BEFORE the pipeline runs, so every score it produces silently assumes an environment nobody verified.

## The run

`./rehearsal.ts run --case audit-log --model sonnet --effort medium --session-budget-usd 4`

Two refusals before it started, both correct:
1. Exit 2, "Provide --model or BENCHMARK_MODEL". The case declares no model, so a first run cannot be made from the case alone.
2. Exit 2, "Commit the control repository before running the benchmark". A note on this very card had made the tree dirty. The refusal is right: it is what pins which corpus produced the score.

Then the run proceeded: baseline checks, shape session, shape judge, STOP.

Outcome: **STAGE_JUDGE_FAILED**, shape graded F against a minimum of B, target restored to 102e39b. Exit 1. Record at .benchmark-runs/2026-09-04T02-09-23.870Z.shape.json (92 KB). One checkpoint recorded: `checkpoint:2026-09-04T02-09-23.870Z/initial`.

Cost: **0.43 USD** for the shape session (two provider calls, 0.206 + 0.224), 103 seconds of session time. Well under the 10 USD ceiling. See finding 5: this number is incomplete.

## Why the judge failed it, and what is the tool's fault

The judge fired two hard blockers. One is the agent's fault. One is the harness's.

FINDING 2 (the harness's fault, and the biggest one): **the harness installs rehearsal's own CLAUDE.md into the target repository as the target's project instructions.**

src/benchmark/config.ts: `PROJECT_INSTRUCTIONS_PATH = resolve(CONTROL_DIR, "CLAUDE.md")`, described in its own comment as "the project instructions under evaluation... they are corpus, not case". src/benchmark/backlog.ts `installInstructions` writes that file into the target and commits it.

So the shape agent, working in a NestJS/MikroORM/BullMQ/Postgres app, was handed a CLAUDE.md that says "TypeScript on Bun. No framework, no database, no server." It noticed, said so in its completion message, shaped the task from the real code instead, and asked whether to open a card to fix the file. That question then became a third judge finding against it, for ending a stage on an open question.

The agent behaved well and was penalized for the harness's defect. For a tool whose entire purpose is measuring what instructions do, feeding the agent instructions for the wrong project is a defect that invalidates any pipeline-case score against a target that is not this repository.

FINDING 3 (the agent's fault, and the rule is right): the shape stage created GLOSSARY.md and did not commit it, leaving the worktree dirty. `assertWorkspaceCleanAt`/`capturePlanningAdvance` in src/benchmark/target.ts refused the stage. Correct behavior, and exactly the stage-hygiene rule.

FINDING 4 (the harness's fault, smaller): **the harness tells the judge only "Target baseline changed unexpectedly", with no detail.**

That one string is the entire `harnessFailure` field in the record. Three distinct conditions raise it in target.ts: wrong branch, dirty worktree, or moved SHA. The judge cannot tell which, so it wrote "the stage did not leave a valid repository state" and fired the `invalid-stage-delivery` hard blocker on an inference. The operator cannot tell which either without reading the source. The message should name the condition and the paths.

FINDING 5: **the run record does not carry the judge's cost.** The only costUsd in the artifact belongs to the shape session. The stage judge is a separate provider session and its spend is recorded nowhere, so the artifact understates what a run cost. For a tool that exists partly to price corpus changes, cost accounting that omits the judge is not usable.

FINDING 6: **`rehearsal list runs` prints a raw ENOENT for the run that just completed.** It reports `run:2026-09-04T02-09-23.870Z: ENOENT ... open '.benchmark-runs/2026-09-04T02-09-23.870Z.json'`, because a stopped run writes `<id>.shape.json` and the lister looks for `<id>.json`. Same class as ACT-40, on the run path rather than the attempt path. So a stopped run is invisible to `list` and is only findable by reading the directory.

## What this says about the milestone

The loop ran. A real pipeline executed against a real repository, produced a real judged verdict, recorded a checkpoint, and restored the target. That was never true before today.

It also produced five defects in one 0.43 USD run, four of them invisible to the whole unit-test suite, and one of them (finding 2) severe enough to invalidate pipeline-case scores. This is what the milestone was for.

## Final summary, 2026-09-04

The loop ran. A real pipeline executed two provider sessions against a real NestJS repository, produced a judged verdict, recorded a checkpoint, and restored the target to 102e39b. None of that had ever happened before today.

Outcome: shape graded F (minimum B), run stopped, exit 1. 0.43 USD, 103 seconds of session time, against a 10 USD ceiling.

### Acceptance

- #1 UNCHECKED, and the criterion was wrong as written. It says the artifact lands 'under .benchmark-runs/runs'. There is no runs/ directory; a stopped run writes .benchmark-runs/<id>.<stage>.json at the root. The run WAS invoked and its outcome WAS recorded, so the substance holds; the path in the criterion was my guess and the guess was wrong. Not carried forward as work.
- #2 UNCHECKED, and it is a real defect, filed as ACT-44. `list runs` prints a raw ENOENT and `show` refuses with exit 3, both because they look for <id>.json while the record is <id>.shape.json.
- #3 checked. Cost, duration, and the judge's verdict are recorded above.
- #4 checked. Six findings, four filed as cards.

### Cards filed from this run

- ACT-41 (m-1, high): the harness installs its own CLAUDE.md into the target. The severe one.
- ACT-42 (m-1, medium): one baseline-failure message for three distinct conditions.
- ACT-43 (m-3, medium): the run record omits the judge's cost.
- ACT-44 (m-1, high): list and show cannot see a stopped run.
- ACT-45 (m-2, high): nothing verifies the target is green before a run spends money.

### Handoff

What changed: no source code. This card is an observation, and the only commits are board records.

What became possible: ACT-39 can now run. Checkpoint `checkpoint:2026-09-04T02-09-23.870Z/initial` exists and is what it replays from.

What I observed directly: the two pre-run refusals and their exit codes, the baseline going from red to green across three states, the run's own stdout, the record on disk, the checkpoint in `list checkpoints`, and the failures of `list runs` and `show`.

What I did not verify: whether ACT-41 alone would have lifted the grade above B. Two of the judge's findings (the 201/202 contradiction and the dropped validation rules) are substantive and independent of the harness's defects, so a re-run after ACT-41 may still fail, for better reasons.

Left running: postgres in the target's compose project (`docker compose` at /Users/joaofnds/code/nest/template). ACT-39 needs it. Redis never started, port 6379 was already taken, and the run did not need it.

Review: not due. No source changed.
<!-- SECTION:NOTES:END -->
