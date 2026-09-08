---
id: ACT-51
title: 'let a run in flight be watched, which nothing on disk allows today'
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-08 12:51'
labels: []
milestone: m-6
dependencies:
  - ACT-49
  - ACT-52
  - ACT-53
priority: medium
ordinal: 53008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The live monitor is the screen Joao named as deserving the most design effort, and it is the one with no data behind it.

Today a run writes its record when a stage finishes. Progress goes to stdout as prose (14 console.log sites, ACT-26.7), nothing is written while a stage is in flight, and no process other than the one running the benchmark can see its state. So there is nothing for a monitor to read.

The design shows: which step is running, a spend bar against the ceiling, a wall clock, the agent session streaming, the judge panel, and a task graph whose nodes carry in/out counts for instruction files loaded and artifacts produced. Also an interrupted run that was reconciled, which needs partial state to survive a crash.

The lost UI solved this with durable run events and a startup reconciliation pass (migrations 0006-run-events and src/run-execution/startup-reconciliation.ts, both named in docs/recovered). That is evidence the shape is workable, not a design to copy: those files did not survive.

This is the largest card in m-4 and it is a harness change before it is a UI change. It should be shaped before it is built, and the shaping should decide whether run state becomes a file the harness appends to, a socket, or something else. ACT-26.7 lands underneath either way, since harness progress currently pollutes stdout.

Depends on the gap inventory, which is what establishes the real scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run in progress is observable by a second process while it runs, and what that process reads is written down
- [ ] #2 The monitor shows the running step, spend against the ceiling, and elapsed time, observed against a real run rather than a fixture
- [ ] #3 A run killed partway leaves state a later reader can reconcile into an interrupted outcome, observed by killing one
- [ ] #4 Harness progress no longer goes to stdout as prose, satisfying ACT-26.7 or superseding it explicitly
- [ ] #5 Introduces no raw visual value and no component the design system does not already own; anything new is added to the system, per decision-2
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vocabulary: this card's labels, routes, and API shapes follow decision-5 and GLOSSARY.md — code/records/CLI keep run, stage, pipeline, case, attempt, rep, confirmation run; the design's task, step, and plural "attempts"/"group" are UI labels only, mapped in GLOSSARY.md.

Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Answers, 2026-09-08 (typed into the iterate session by Joao, "agree" to the four questions as recommended):

1. Storage is not an open question. decision-3 settles it: SQLite in WAL mode, derived and rebuildable, records on disk stay authoritative, SSE for push. Add the live writes at the existing transition points in src/benchmark/run-abort.ts (writePendingStage, writeStageProgress, completeStage) and the per-turn loop in src/benchmark/workflow.ts that already computes spentUsd and providerCalls. No parallel mechanism.

2. AC #2 needs turn-and-stage-boundary granularity only: current stage, spend against the ceiling, elapsed time. Live tool-call chips, the task graph's in/out counts, and mid-turn token streaming are ACT-96 through ACT-100's, not this card's. The harness invokes claude as a subprocess per turn and receives one complete envelope, so sub-turn streaming would be new plumbing this card never scoped.

3. Add INTERRUPTED to the run status union in src/benchmark/contracts.ts as a state distinct from FAILED. Today a killed run writes FAILED (markAborted in run-abort.ts) and the design renders a stopped run as neutral rather than a failure. This is a contract change touching every reader of run status.

4. Reconciliation splits: leave run-abort.ts's existing SIGINT/SIGTERM/SIGHUP handler as it is, since it already writes a terminal state on a graceful kill. Add a startup reconciliation pass in the server for the crash case (SIGKILL, OOM, power loss) that leaves no terminal write: a run whose event state says running with no terminal record on disk reconciles to INTERRUPTED. This keeps the card almost entirely out of rehearsal run.

5. Add both terms to GLOSSARY.md, wording as proposed: run event (one durable, timestamped fact about a run in progress, held in the derived SQLite store per decision-3, replayed to a client over SSE) and interrupted run (a run whose process ended without writing a terminal status, reconciled from run events on server startup into a distinct, non-failure outcome). Neither collides with a term in the glossary today.

Probed this session before the answers were given: no RUNNING or INTERRUPTED appears in contracts.ts (its status unions are AWAITING_HUMAN_REVIEW|COMPLETE|FAILED and FAILED); the run-abort.ts and workflow.ts symbols above exist as named; ACT-96 through ACT-100 do own the task-graph detail deferred in answer 2.
<!-- SECTION:NOTES:END -->
