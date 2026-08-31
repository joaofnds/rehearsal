---
id: ACT-5
title: run N reps in parallel worktrees
status: Build
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-08-31 16:57'
labels: []
dependencies:
  - ACT-3
  - ACT-10
  - ACT-14
references:
  - docs/design.md
  - docs/research.md
ordinal: 5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Execute an explicitly requested confirmation run as N isolated stage replays or full-pipeline reps from one frozen input set, then report reliability, resource use, and elapsed time without presenting single-rep debug evidence as a score.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI tests observe that existing replay and benchmark commands still run one debug rep when confirmation is absent; --confirm selects confirmation with 5 reps, --confirm --reps N overrides N, --reps without --confirm and confirmation counts below 2 are rejected, and debug output says "single-rep evidence, not a score" while retaining the individual Judge result.
- [ ] #2 A coordinator test blocks three fake reps at a barrier and observes all three started before any is released; each receives a distinct rep ID and worktree path while sharing byte-identical frozen corpus, rubric, model, effort, source SHA or checkpoint lineage, and pipeline inputs.
- [ ] #3 Integration tests observe both three stage replays and three full-pipeline reps execute in detached worktrees without changing the primary checkout HEAD, branch, status, or files; stages remain sequential inside each full-pipeline rep while reps overlap in time.
- [ ] #4 Before a confirmation creates a worktree or starts a session, CLI output shows a deterministic maximum cost derived from configured budgets and maximum worker, PO, and Judge calls including retries; execution waits for explicit approval, and --yes supplies that approval noninteractively.
- [ ] #5 Every rep writes a collision-free strict record containing its ordinal, outcome, stage evidence, lineage, actual role-attributed cost and token usage, worker trajectory steps, monotonic elapsed durations, and retained result evidence; the group writes its frozen inputs, projected cost and approval, rep-record references, and aggregate report.
- [ ] #6 For every declared stage and the final outcome, a 5-rep report shows attempted, not-reached, failed, and successful counts; the raw Judge-grade distribution; binary success rate p with CLT standard error sqrt(p(1-p)/n); and pass^k = p^k with k equal to the requested rep count. It also shows per-role and total cost and input/output/cache token distributions, worker-turn distributions, per-stage elapsed-duration distributions, and overall parallel makespan.
- [ ] #7 A declared stage outcome is successful only for Judge grade A or B; the final outcome is successful only for final Judge PASS. STOP, final FAIL, execution failure, and missing required provider metrics are unsuccessful and are never converted to zero-valued evidence.
- [ ] #8 When one rep fails or stops, the other reps finish; that rep records the failure and preserves its worktree when diagnosis requires it, later stages are marked not reached, aggregate denominators expose attempted and not-reached reps, and full-pipeline reliability counts the rep as unsuccessful.
- [ ] #9 After every completed rep, its worktree is removed even when its Judge rejects the result; after an induced pre-evidence failure, the preserved worktree path is printed. Concurrent worktree creation, record writes, and cleanup do not collide.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: execute a confirmation run as isolated parallel reps over frozen inputs and produce honest reliability and resource-use evidence.

Resolved decisions (João delegated these on 2026-08-31):
1. Quality is not an arbitrary numeric mapping of A-F. Each declared-stage rep contributes a binary outcome: A/B is success and C/D/F or STOP is unsuccessful. The final outcome is PASS/FAIL. Reports retain raw grade distributions, estimate p with its CLT standard error, and report pass^k as p^k for k equal to the requested rep count. ACT-6 will own clustered and paired estimates across tasks/checkpoints.
2. Confirmation is explicit. Existing commands remain one-rep inner-loop debugging. --confirm defaults to 5; --reps N is valid only with --confirm and N must be at least 2. One rep may show its Judge evidence but carries the exact not-a-score label.
3. A confirmation group freezes all controlled inputs before concurrency: target source SHA or consumed checkpoint, corpus files, rubrics, pipeline, model, effort, Judge settings, and budgets. Every rep has a stable group ID plus ordinal; wall-clock timestamps never provide identity or ordering.
4. Actual cost and tokens include worker, PO, stage Judge, and final Judge calls, retained by role and totaled. Tokens preserve provider-reported input, output, cache-read, and cache-write counts. A trajectory step is the provider-reported worker-agent turn; PO and Judge turns are excluded because trajectory length measures corpus-induced workflow behavior. Missing required confirmation metrics fail the rep explicitly instead of becoming zero.
5. Per-stage elapsed duration uses a monotonic clock from the first worker call through completion of that stage Judge, including PO exchanges and checks. Worktree setup/cleanup are group overhead; the report separately records parallel makespan.
6. Reps are failure-isolated and coordinated with all-settled semantics. One failure or STOP does not cancel peers. Downstream stages for that rep are not reached, not silently failed; the final pipeline outcome still counts that rep as unsuccessful. Interactive human calibration is excluded from confirmation because interaction would alter and serialize the measured reps; their Judge evidence remains available to the separate calibration workflow.
7. Before paid work, the harness presents a deterministic maximum from configured budgets and bounded call counts, including Judge retries, and requires approval. This is deliberately a ceiling rather than a historical guess. --yes is the explicit automation boundary.
8. Isolation covers target files, Git state, worktrees, retention refs, and run artifacts. Ports, databases, queues, credentials, and other shared host resources remain the target project responsibility; ACT-5 does not add containers or service virtualization.

Interfaces likely to move:
- Put collision-free group, rep, and report paths behind the shared run-layout boundary delivered by ACT-14.
- Separate one worktree-scoped full-pipeline rep from process signal/abort handling delivered by ACT-10; a confirmation coordinator delegates to that primitive and the existing replay primitive.
- Persist a strict confirmation-group envelope and strict rep envelopes before deriving a report. Pin any result commit that recorded evidence cites under a rep-specific retention ref.
- Snapshot controlled inputs once for the group; rep plans are immutable values consumed by injected execution effects.

Deliberately unplanned: implementation names, output formatting beyond the observable fields, scheduling optimizations, external-service isolation, paired comparisons, control arms, and clustered standard errors. ACT-6 owns comparisons and cross-checkpoint statistics.

Glossary terms added: Confirmation run, Rep outcome, Score, Trajectory step.

First test to write: drive a pure/injected confirmation coordinator with three fake reps blocked on a barrier, and observe all three have distinct identities and have started from the same frozen plan before any can complete.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped from docs/vision.md, docs/design.md, docs/research.md, the completed ACT-3 replay primitive, current CLI/artifact contracts, and ACT-3 review findings. ACT-10 is a prerequisite because runBenchmark currently owns process-wide signal state and mutates the primary checkout; ACT-14 is a prerequisite because adding group and rep paths to the existing three duplicated layout implementations would deepen a known silent data-coupling defect.

Build checkpoint 2026-08-31: confirmation CLI parsing and invalid-state guards; deterministic cost projection and approval dispatch; concurrent all-settled coordinator with stable rep identities; optional provider cost/token/turn retention across worker, Product Owner, and Judge calls; strict group and rep schemas; reliability and resource distributions; collision-free group layout; and frozen skill-corpus snapshot/install are committed through 6199229. Full suite: 281 pass, 0 fail; typecheck, lint, and format check pass. Production entry points are not yet switched: --confirm still reaches the legacy single-run path and must not be used until stage and pipeline confirmation executors are wired. Next test: run three replay reps through the coordinator with frozen checkpoint, corpus, and rubric inputs, proving overlapping detached worktrees, strict records, primary-checkout invariants, and cleanup.

Build checkpoint 2026-08-31, stage replay confirmation slice: replay-stage.ts now keeps debug replay at one rep with the exact "single-rep evidence, not a score" label and routes --confirm through deterministic projected-cost approval before the confirmation executor can snapshot inputs, create worktrees, or start sessions. The stage executor freezes the consumed checkpoint, all relevant stage corpus snapshots, rubric, instructions, task, product brief, pipeline, model/effort, Judge settings, checkpoint lineage, and session budget once; runs reps through the existing concurrent all-settled coordinator with stable IDs and collision-free artifact paths; writes strict group and rep records plus report evidence; retains result refs; removes completed and Judge STOP/validation-rejection worktrees; and preserves and prints the worktree for a pre-evidence worker failure while peers finish. Real-Git integration tests observed three detached worktrees overlap, consume byte-identical frozen inputs, emit distinct strict records, clean up, and leave primary HEAD, branch, status, and file bytes unchanged. A second integration test observed STOP and exhausted Judge-validation cleanup, one preserved worker-failure path, and both peers finishing. Full suite: 285 pass, 0 fail; typecheck, lint, and format check pass. No Claude or paid execution ran. Full-pipeline confirmation in run-benchmark.ts remains deliberately unwired, so the broader ACT-5 acceptance criteria remain unchecked.
<!-- SECTION:NOTES:END -->
