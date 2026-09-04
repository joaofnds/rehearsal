---
id: ACT-38
title: 'run the audit-log pipeline once, end to end, and record what it cost'
status: To Do
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-04 02:08'
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
- [ ] #3 The run's wall-clock, dollar cost, and per-stage judge results are recorded on this card
- [ ] #4 Every place the harness refused, surprised, or misled the operator during the run is recorded on this card, one line each, as a candidate card
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

Why this matters beyond this run: the harness runs these three checks as the delivery stage's gate. Had the run started 20 minutes ago, the build stage would have been judged against a target whose tests fail for reasons no agent caused, and the failure would have been attributed to the agent's work. The tool has no baseline precondition check: nothing verifies the target is green BEFORE the pipeline runs, so every score it produces silently assumes an environment nobody verified.

That is a card, not a note. See the candidate list in the final summary.
<!-- SECTION:NOTES:END -->
