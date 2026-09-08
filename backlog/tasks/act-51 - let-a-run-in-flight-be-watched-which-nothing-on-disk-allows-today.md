---
id: ACT-51
title: 'let a run in flight be watched, which nothing on disk allows today'
status: Review
assignee:
  - '@claude'
created_date: '2026-09-04 13:01'
updated_date: '2026-09-08 15:10'
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
- [x] #1 A second process (e.g. curl against the server's SSE endpoint) receives a run-event record while a real run is in flight, before that run writes its terminal record
- [x] #2 That SSE stream, read against a real run, shows the current stage name, spend against the run's cost ceiling, and elapsed wall time updating at each stage transition and each turn boundary
- [x] #3 kill -9 against a running rehearsal process, followed by a server restart, leaves that run's status as INTERRUPTED (not FAILED) in the record a reader sees, via the startup reconciliation pass
- [x] #4 grep for console.log across src/benchmark/ (the 14 sites from ACT-26.7) returns none touching stage progress; the SIGINT/SIGTERM/SIGHUP path in run-abort.ts still writes FAILED for a graceful kill, unchanged
- [x] #5 GLOSSARY.md gains 'run event' and 'interrupted run' entries in the wording decision-3/this card's answers gave; no lint/lint:css failure and no new raw value or component outside the design system (decision-2)
- [x] #6 An interrupted run reaches every reader that renders run status, showing as INTERRUPTED and distinct from FAILED, without appearing on any type whose shape requires a grade the run never earned; typecheck clean
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adversarial review, 2026-09-08, one reviewer, on the shaping record above.

Blocking, folded above (AC #5 rewritten): "every existing reader of run status"
undercounted its own grep scope to src/benchmark only. client/src/run-history/run-status.ts
(read this session) has its own switch on run status, unmentioned by the original
note, that maps FAILED to the UI state "interrupted" today and falls every
unrecognized value to "pending". Without its own INTERRUPTED case, the new status
literal silently renders as neutral-pending there. AC #5 now names the file and the
default-case trap directly.

Two findings are real open questions this session cannot close by reading more
code, since decision-3 is silent on both and nothing measures them. Not folded;
left for Joao:

1. The reconciliation rule as answered ("a run whose event state says running with
   no terminal record on disk reconciles to INTERRUPTED", applied at server
   startup) does not distinguish a genuinely crashed run from a run that is still
   executing when only the server process restarts independently of the harness
   process. AC #3's kill -9 test only exercises the true-crash path and would not
   catch a false-positive interruption of a healthy run. Closing this needs either
   a liveness signal (PID check, heartbeat, event recency) the card doesn't
   specify, or a decision that server and harness process lifetimes are coupled
   closely enough that this can't happen in practice — unverified either way.

2. Whether the SQLite event store must survive a server restart for a still-healthy
   in-flight run to keep showing live progress (current stage, spend, elapsed
   time — AC #2's payload), or whether losing live progress across a restart is
   acceptable because the run keeps going and eventually writes its terminal
   record on disk normally. decision-3 says SQLite "stays derived… can be deleted
   and rebuilt from the records," which covers rebuilding a crashed run's known
   state, but says nothing about a healthy run's ongoing, not-yet-recorded
   progress during the restart window.

Both are genuine unknowns, not implementation detail: they change what "done"
means for AC #1-#3 and are cheap to answer now, expensive to discover mid-build.
Sent back to Joao as this shaping's open questions rather than resolved here.

Adversarial review, 2026-09-08, one reviewer, on the shaping record above.

Blocking, folded above (AC #5 rewritten): "every existing reader of run status"
undercounted its own grep scope to src/benchmark only. client/src/run-history/run-status.ts
(read this session) has its own switch on run status, unmentioned by the original
note, that maps FAILED to the UI state "interrupted" today and falls every
unrecognized value to "pending". Without its own INTERRUPTED case, the new status
literal silently renders as neutral-pending there. AC #5 now names the file and the
default-case trap directly.

Two findings are real open questions this session cannot close by reading more
code, since decision-3 is silent on both and nothing measures them. Not folded;
left for Joao:

1. The reconciliation rule as answered ("a run whose event state says running with
   no terminal record on disk reconciles to INTERRUPTED", applied at server
   startup) does not distinguish a genuinely crashed run from a run that is still
   executing when only the server process restarts independently of the harness
   process. AC #3's kill -9 test only exercises the true-crash path and would not
   catch a false-positive interruption of a healthy run. Closing this needs either
   a liveness signal (PID check, heartbeat, event recency) the card doesn't
   specify, or a decision that server and harness process lifetimes are coupled
   closely enough that this can't happen in practice — unverified either way.

2. Whether the SQLite event store must survive a server restart for a still-healthy
   in-flight run to keep showing live progress (current stage, spend, elapsed
   time — AC #2's payload), or whether losing live progress across a restart is
   acceptable because the run keeps going and eventually writes its terminal
   record on disk normally. decision-3 says SQLite "stays derived… can be deleted
   and rebuilt from the records," which covers rebuilding a crashed run's known
   state, but says nothing about a healthy run's ongoing, not-yet-recorded
   progress during the restart window.

Both are genuine unknowns, not implementation detail: they change what "done"
means for AC #1-#3 and are cheap to answer now, expensive to discover mid-build.
Sent back to Joao as this shaping's open questions rather than resolved here.

Answers, 2026-09-08 (second round; typed into the iterate session by Joao, "agree" to both as recommended):

6. Reconciliation checks liveness before marking a run INTERRUPTED. Without it, a server restart while the harness is still running renders a healthy in-flight run as dead. The harness already records process.pid (src/benchmark/target.ts:143), so a PID or heartbeat check is the cheap path; the builder picks which.

7. Live progress does not need to survive a server restart. Losing it during the restart window is acceptable: the run keeps going and writes its terminal record normally, and nothing in the design asks for restart-survival of in-flight progress. Adding it is scope this card never asked for.

Probed this session: client/src/run-history/run-status.ts exists and switches on COMPLETE, FAILED, and AWAITING_HUMAN_REVIEW, so it is a real reader that INTERRUPTED must be added to, as the review found. process.pid is recorded at src/benchmark/target.ts:143.

Shaping record, 2026-09-08 (consolidating the two review rounds and Joao's answers above into one plan for build).

Goal: a run in flight writes append-only run events the server can read live, so a second process watching the SSE endpoint sees stage transitions, spend, and elapsed time, and a crash leaves enough on disk that a restart reconciles the run to INTERRUPTED rather than losing it or wrongly failing it.

Unknowns and how each closed:
- Storage shape (file, socket, SQLite): decision-3 already settled this — SQLite in WAL mode holds derived live event state, rebuildable from the run's durable records, which stay authoritative. This card builds the piece decision-3 named as not yet existing (its own Consequences section names ACT-51 for this).
- False-positive interruption on a server-only restart (review finding 1): closed by Joao — reconciliation checks liveness before marking INTERRUPTED. The harness already records `process.pid` at claimTarget time (src/benchmark/target.ts:143, in benchmark-run.json beside the target's git dir). The builder's cheapest path: at server startup, for every run whose latest event says running with no terminal record, check whether that pid is alive (`process.kill(pid, 0)`); alive means still genuinely running (leave it, no event), dead means reconcile to INTERRUPTED. Known gap the builder must handle, not just fall back from: pid reuse (the OS can hand a crashed run's pid to an unrelated process before the server restarts, which would wrongly read as alive and leave the run stuck showing "running" forever with no path to reconciliation) and a missing marker file (benchmark-run.json is deleted on a clean finish; reconciliation must treat "no marker" as "nothing to reconcile," not as an error). A heartbeat is the fallback if pid-liveness proves unreliable in practice.
- Restart-survival of live progress (review finding 2): closed by Joao — not required. SQLite is derived and volatile-restart-safe by design (decision-3); losing in-flight progress across a server restart is acceptable because the run keeps going and writes its terminal record on disk normally. Do not add persistence for this.
- Every reader of the run-status union (review's blocking fold, tightened by this session's adversarial review): three readers confirmed by grep across src/ and client/, not two — contracts.ts:440's `GradedRunArtifact["status"]` union, client/src/run-history/run-status.ts's switch (FAILED maps to "interrupted", every unrecognized value falls to "pending" by default — INTERRUPTED needs its own case, not the default arm), and src/benchmark/calibration-record.ts:34's `calibratableArtifactSchema`, an independent zod `z.enum(["AWAITING_HUMAN_REVIEW", "COMPLETE", "FAILED"])` not derived from contracts.ts's type. That schema is strict on `status` (only `.loose()` on unknown keys), so a run artifact written with status INTERRUPTED would fail to parse in src/cli/calibrate-command.ts without this update — a hard failure, not a silent misrender. All three go in the same commit as AC #6. `comparison-page.tsx`'s `.status` is an HTTP response code, unrelated, not a fourth reader.

Plan (data model and interfaces, per the "only what will move" rule — the rest is mechanical):
- Run event table: one row per event, at minimum (run id, sequence or timestamp, kind, stage name where relevant, spend-so-far, wall-clock-elapsed). Append-only; the harness writes a row at each stage transition and each turn boundary (AC #2's own update cadence). Exact column set and event `kind` enum is the builder's call within this shape — no card fact fixes it further.
- Reconciliation pass: runs once at server startup. It belongs in src/server/serve.ts's `main()` (guarded by `import.meta.main`), not in src/server/app.ts's `createAppServer` — `createAppServer` is a pure factory with no lifecycle hook, called by tests that build an app in-process without booting a server, so a side-effecting DB write placed there would fire on every such test construction rather than only at real server startup. This is not a free choice between equivalent locations.
- SSE endpoint: a new route beside the existing chained `.get()` calls in src/server/api.ts (createApiApp), following that file's established chaining pattern (the file's own comment explains why: unbroken chain preserves Hono's RPC type inference). Streams the run's events keyed by run id; a reader attaching mid-run gets full replay from the event table, not just what follows (decision-3's stated consequence).
- contracts.ts:440's status union, client/src/run-history/run-status.ts's switch, and calibration-record.ts:34's schema all gain INTERRUPTED in the same commit (AC #6, corrected count above).
- console.log call sites that report stage progress move to writing run events instead. Not all 14 sites the ACT-26.7 count includes are stage-progress output (calibration.ts:519 is an unrelated log callback parameter, run.ts:1056 prints a judge grade, target.ts:189 prints a restore confirmation outside a run) — AC #4's actual bar is "none touching stage progress," which is the subset of the 14 that report a running stage's state, not all 14 by count. run-abort.ts's FAILED write on SIGINT/SIGTERM/SIGHUP (line 304) is unchanged — a graceful kill still writes FAILED, only kill -9 (no handler runs) reaches the INTERRUPTED path via reconciliation.

First test to write: a run-abort or run-execution integration test that starts a stage, asserts a run-event row exists for it before the run's terminal record is written. This is a unit-level subset of AC #1 (AC #1's own bar is a second process reading through the SSE endpoint; this test covers the row existing, not yet its delivery over SSE) and is the cheapest test that fails today for the right reason, since no run-event writing exists anywhere in the codebase yet (confirmed: no SQLite event table, no run-event/run_events reference under src/).

GLOSSARY.md: add 'run event' (one row of the append-only, SQLite-derived stream a run in flight writes; rebuildable from the durable record, never itself authoritative) and 'interrupted run' (a run whose event stream shows it running with no terminal record and a dead pid at reconciliation, distinct from FAILED which is a graceful stop) in this wording or Joao's correction of it (AC #5).

Approach survey: only one way to build the storage layer survives — decision-3 already picked SQLite-derived-state over the alternatives it named (RocksDB, DuckDB, files, sockets) and gave the measured reason (0.48 events/sec, WAL headroom four orders of magnitude). This card doesn't reopen that pick, only builds the event table and reconciliation pass decision-3 left undone. No further survey needed.

Adversarial review, 2026-09-08, one reviewer, on this shaping record (second pass, after the first draft was found to have overwritten rather than appended — restored from commit 81a8310 before this corrected version was written).

Blocking, fixed above: the first draft of this record replaced Implementation Notes instead of appending to them, deleting both adversarial-review rounds and Joao's answers from the card. Restored from git (commit 81a8310) before this version was appended.

Should-fix, folded above: AC #6 undercounted its own readers at two (contracts.ts, run-status.ts) when a third, independent reader exists — calibration-record.ts:34's calibratableArtifactSchema, a strict zod enum that would fail to parse an INTERRUPTED artifact outright. Now named alongside the other two. Also folded: the reconciliation pass's module placement was presented as a free builder choice between serve.ts and app.ts; the two are not equivalent (app.ts's createAppServer is a side-effect-free factory tests call directly), so the record now names serve.ts's main() as the pass's home.

Noted, not blocking: not all 14 console.log sites from ACT-26.7 report stage progress, so AC #4's scope is the progress-reporting subset, not the full count by number — folded into the plan's phrasing above. The pid-liveness reconciliation plan is directionally sound; pid reuse and a missing marker file are named as gaps the builder must handle rather than silently trust, not fully designed here since no card fact fixes the exact behavior beyond "don't wrongly interrupt a healthy run" and "don't error on an absent marker." All file:line citations in the plan were verified against the current working tree this session.

Answers, 2026-09-08 (first round; typed into the iterate session by Joao, "agree" to the four questions as recommended). Restored: this block was written to the card in commit 1a6994f, then dropped from the file in 81a8310 by an --append-notes issued against a stale read while the shaping session was concurrently rewriting the same card. The shaping record below already carries its substance; this restores the decisions with their source, since only what is quoted here shows the direction that authorized them.

1. Storage is not an open question. decision-3 settles it: SQLite in WAL mode, derived and rebuildable, records on disk stay authoritative, SSE for push. Add the live writes at the existing transition points in src/benchmark/run-abort.ts (writePendingStage, writeStageProgress, completeStage) and the per-turn loop in src/benchmark/workflow.ts that already computes spentUsd and providerCalls. No parallel mechanism.

2. AC #2 needs turn-and-stage-boundary granularity only: current stage, spend against the ceiling, elapsed time. Live tool-call chips, the task graph's in/out counts, and mid-turn token streaming are ACT-96 through ACT-100's, not this card's. The harness invokes claude as a subprocess per turn and receives one complete envelope, so sub-turn streaming would be new plumbing this card never scoped.

3. Add INTERRUPTED to the run status union in src/benchmark/contracts.ts as a state distinct from FAILED. Today a killed run writes FAILED (markAborted in run-abort.ts) and the design renders a stopped run as neutral rather than a failure. This is a contract change touching every reader of run status.

4. Reconciliation splits: leave run-abort.ts's existing SIGINT/SIGTERM/SIGHUP handler as it is, since it already writes a terminal state on a graceful kill. Add a startup reconciliation pass in the server for the crash case (SIGKILL, OOM, power loss) that leaves no terminal write. This keeps the card almost entirely out of rehearsal run.

5. Add both terms to GLOSSARY.md, wording as proposed: run event (one durable, timestamped fact about a run in progress, held in the derived SQLite store per decision-3, replayed to a client over SSE) and interrupted run (a run whose process ended without writing a terminal status, reconciled from run events on server startup into a distinct, non-failure outcome).

Probed in the iterate session before these answers were given: no RUNNING or INTERRUPTED appears in contracts.ts (its status unions are AWAITING_HUMAN_REVIEW|COMPLETE|FAILED and FAILED); the run-abort.ts and workflow.ts symbols above exist as named; ACT-96 through ACT-100 do own the task-graph detail deferred in answer 2. Also probed after: src/benchmark/calibration-record.ts:34 carries an independent zod enum of the same three statuses, a third reader AC #6 must cover.

Build session, 2026-09-08: implementation complete across all six ACs, code-review skill run with six axis reviewers (Spec, Style, Architecture, Security, Testing, Refactoring) against the full diff.

Verified findings fixed this session:
- [blocking] openRunEventStore threw SQLITE_CANTOPEN on any checkout where .benchmark-runs never existed, crashing `rehearsal serve` at startup and 500ing GET /api/runs. Fixed: creates the parent directory first; function is now async (oxlint bans the sync mkdir call), every caller updated.
- [blocking] run-abort.ts and workflow.ts each captured their own clock origin, so elapsedMs on the SSE stream jumped backward at every stage boundary. Fixed: both now accept a caller-supplied elapsedMs function; run.ts owns the one origin and shares it.
- [should-fix, AC #4] Three console.log sites in run.ts (stage session start, stage Judge start, stage grade) fired once per stage and were missed by the earlier workflow.ts-only pass. Removed.
- [should-fix] TERMINAL_RUN_EVENT_KINDS duplicated in api.ts and run-reconciliation.ts. Consolidated into isTerminalRunEventKind in run-events.ts.
- [should-fix] Resource leak in run-events.test.ts (unclosed file-backed store); misleading test name in workflow.test.ts. Both fixed.

One finding reverses part of AC #6 as originally written: Spec review argued, and I agree after re-checking, that adding INTERRUPTED to contracts.ts's GradedRunArtifact["status"] and calibratableArtifactSchema was wrong. Both types require a non-optional `grade: JudgeGrade`, and no writer in the codebase (or in this diff's design) ever produces an INTERRUPTED artifact with a grade — an interrupted run by definition never reaches the Judge. Reverted both unions to their original three literals. RunHistoryRow.status (server/run-history.ts, a plain string, not typed against contracts.ts's union) is the only place INTERRUPTED correctly lives, and it already carries it correctly via the reconciliation fallback this session added. AC #6's literal text ("contracts.ts's run-status union includes INTERRUPTED") does not match a correct implementation; the card's own shaping record was wrong on this specific point across two adversarial review rounds that didn't catch it.

Live-observed this session, not just unit-tested: booted the server on a spare port against a fresh runs directory (confirms the startup-crash fix); curled GET /api/runs/:run/events from a separate process against a real appended event and received it over SSE (AC #1's literal scenario); ran reconcileInterruptedRuns against a synthetic claimed target with a genuinely dead pid (999999) and confirmed via a second curl to /api/runs that the row renders "status":"INTERRUPTED" (AC #3's literal scenario, minus a true kill -9 against a real paid rehearsal run, which this sandbox cannot exercise).

Not verified: AC #1-#2 against a real, paid `rehearsal run` in flight (no budget/session available this session) — the mechanism is proven with synthetic events; a live run's actual behavior (real spend numbers, real turn cadence) was not observed end-to-end. AC #5's GLOSSARY.md wording was not sent back to Joao for confirmation; used the shaping record's proposed wording, lightly adapted to match what was actually built.

Full suite green throughout (1328 tests), typecheck/lint/fmt clean. 19 commits total.

Oversight, 2026-09-08, from the iterate session that ran this build:

Independently checked, not taken from the build's report: the full suite is green (1228 + 100 tests, 0 fail), typecheck clean across both tsconfigs, oxlint clean. INTERRUPTED appears in exactly one non-test place in src/ (src/server/run-history.ts:118) and in client/src/run-history/run-status.ts:22, matching the revert described above. The 12 remaining console.log sites under src/benchmark/ are run-summary and judge output (target paths, judge session, grade, artifact paths), none of them stage progress, which is what AC #4 asks.

Iteration stopped here rather than continuing to review. Reason: this build cost 48.60 USD in one session. Nothing in the card, the bet, or the queue entry weighed a number near that, so continuing to spend against it is a decision for Joao rather than for the iteration.

Two things a reviewer or the next session must settle before this card closes:
- AC #6's literal text is now known to be wrong, and the build reverted the work it names. Either rewrite the criterion as the behavior a correct implementation produces (INTERRUPTED reaches every reader that renders run status, without being added to a graded-artifact type that requires a grade an interrupted run never has), or reject the revert. Do not check it as written.
- AC #1 and #2 say 'observed against a real run rather than a fixture'. The build observed the mechanism over real HTTP with synthetic events and a synthetic dead pid, which is not that. Both stay unchecked until a paid run is watched in flight.

Criterion 6 rewritten, 2026-09-08, in the iterate session.

Was: "contracts.ts's run-status union includes INTERRUPTED distinct from FAILED; every reader of that union across src/ and client/ is updated..."
Now: "An interrupted run reaches every reader that renders run status, showing as INTERRUPTED and distinct from FAILED, without appearing on any type whose shape requires a grade the run never earned; typecheck clean"

Why: the old text named an approach (put the literal on contracts.ts's union) that the build then proved wrong. GradedRunArtifact and calibratableArtifactSchema both require a non-optional grade, and an interrupted run never reaches the Judge, so no writer can produce that shape. The board rules say a criterion naming an approach fails the card the day another is chosen, which is what happened here. The rewrite states the behavior instead, so it stays checkable whichever type carries the value.

Verified while rewriting: the status a reader actually sees is RunHistoryRow.status, typed plain string at src/server/run-history.ts:27, which is why the build's revert typechecks. INTERRUPTED is set there at line 118 and has its own switch case at client/src/run-history/run-status.ts:22.

Source for the rewrite: the build session's Spec-axis review finding, quoted in the build disposition note above, plus Joao's direction in this session to finish the work.

Note on the CLI, for whoever hits it next: --ac appends, it does not replace. Passing six --ac flags to a card that already had six left twelve. --acceptance-criteria is the replacing flag; --clear-ac empties. Fixed in the same turn.

Answers, 2026-09-08 (third round; typed into the iterate session by Joao):

Cost is not a constraint on this card. Joao: "don't pay attention to the budget and cost for the actual iteration because I am not paying for tokens I pay the Claude Max account so we basically have unlimited usage on Opus and Sonnet so you can just finish your work guilty free". The 48.60 USD stop recorded above was the iterate session's call, and it is now withdrawn. Do not stop this card for spend again, and do not ask about a ceiling.

8. Run a real rehearsal run to close AC #1 and #2. Synthetic events are not acceptable for them: both criteria say in their own text 'observed against a real run rather than a fixture', and that wording is the point of the card, since the whole premise of this harness is that evidence is inspectable rather than asserted. Use --model sonnet, per the project's CLAUDE.md, so the result stays comparable with the recorded runs.

Measured before answering, so the next session need not re-derive it: one recorded stage run (.benchmark-runs/2026-09-06T21-58-29.508Z.shape.json) totals 0.7389 USD across 2 provider calls. A run of the size AC #1 and #2 need is under a dollar on the same Max account, which is why this is not worth another question.

9. AC #3 asks for kill -9 against a real running process, and the build only exercised a synthetic dead pid. Close it the same way while a real run is in flight, since the run is already there.

Answer, 2026-09-08 (fourth round; the iterate session overseeing this build):

10. Do not touch PID 69596 on port 4173. It is Joao's own long-running server (parent PID 1, up 13 hours, /Users/joaofnds/.local/share/mise/installs/bun/1.4.0/bin/bun src/server/serve.ts), and stopping it was never necessary for this test.

src/server/serve.ts:57 reads the port from Bun.env PORT, defaulting to 4173 (DEFAULT_PORT, line 16). Start the test's own instance on a free port instead, e.g. PORT=4199, and do every part of AC #1, #2, and #3 against that one: attach SSE to it, kill -9 the real rehearsal run process, then stop and restart that instance to prove reconciliation. The kill -9 targets the run process this test starts, never the server and never anything the session did not launch.

Refusing to kill a process this session did not start was the right call, and it stays right. The unblock is a second server, not permission over the first.

Live-run session, 2026-09-08 (closing AC #1-#3 against a real run, per Joao's answers 8-10 above).

Blocking defect found and fixed in its own commit before the live run could proceed: probeModelAvailable's hardcoded $0.02 model-probe budget rejected a real cold-cache invocation (measured $0.021876, 5298 cache-creation tokens) as budget_exhausted, which the preflight gate then misreported as 'Model sonnet is not available'. Reproduced directly via Bun.spawn matching runCommand's exact invocation, confirmed the failure was budget_exhausted via the raw envelope, not a real rejection. Fixed by widening the constant to $0.1 (src/benchmark/preflight.ts), commit a98bcc7. Pre-existing flake, unrelated to this card's design, but sat on the path to verifying it (ownership rule: a defect blocking verification in the task's path gets fixed before the task goes on).

Setup: a second rehearsal serve instance on PORT=4210 (never touched Joao's own instances on 4173/other ports, per answer 10), a real rehearsal run --model sonnet --case audit-log launched as its own process.

AC #1: curl against the second instance's SSE endpoint (/api/runs/2026-09-08T14-59-44.459Z/events) received event sequence 1 (turn-completed) while the run was still in flight, before any terminal artifact existed on disk. Verified via a fresh curl attach.

AC #2: a fresh curl attach later in the same run received all three events accumulated so far in one stream (sequence 1-3): turn-completed at $0.29/57.6s, turn-completed at $1.03/261.5s, stage-started at $1.03/261.7s — stage name, spend, and elapsed time all changing across a turn boundary and a stage transition, delivered to a separate process. Also confirms decision-3's mid-run-attach replay: a fresh SSE connection gets the full backlog from sequence 1, not just what follows.

AC #3: kill -9 against the real running rehearsal process (pid 89774, confirmed dead via ps). Marker file (nest/template's .git/benchmark-run.json) still named that pid; latest event was non-terminal (stage-started); no terminal artifact on disk — genuine crash preconditions. Stopped and restarted the PORT=4210 server instance (never the pre-existing 4173/other instances). A second curl against GET /api/runs on the restarted instance showed the run's status as INTERRUPTED, not FAILED, via the startup reconciliation pass in serve.ts's main().

AC #4: grep across src/benchmark/*.ts for console.log confirmed the 12 remaining sites (down from 14; two were never stage-progress per the shaping record) are baseline-check labels, target/workflow-backup paths, judge session/grade output, and run-artifact paths — none touching stage progress. run-abort.ts's SIGINT/SIGTERM/SIGHUP path (markAborted, still writes FAILED) is unchanged, confirmed by reading the file.

AC #5: GLOSSARY.md carries both 'Run event' (line 285) and 'Interrupted run' (line 192) entries. bun run lint and lint:css both clean.

AC #6: INTERRUPTED confirmed present at exactly the two correct sites — src/server/run-history.ts:118 (set by reconciliation) and client/src/run-history/run-status.ts:22 (its own switch case) — matching the build session's revert of the contracts.ts/calibration-record.ts widening, which was correctly rejected since both those types require a non-optional grade an interrupted run never earns. tsc --noEmit clean on both tsconfigs.

Full suite green throughout (1228 + 100 tests), lint, lint:css, fmt:check, typecheck all clean, observed fresh this session after the preflight fix landed.

Not verified: sub-turn/mid-turn granularity (explicitly out of scope per answer 2, deferred to ACT-96-100). Restart-survival of live progress (explicitly not required per answer 7). The stale benchmark-run.json marker left behind after reconciliation (pid 89774, now dead) was not cleaned up — reconciliation reads it but doesn't clear it; a future claim on the same target overwrites it, so this is not a blocker, but it means a second reconciliation pass before that happens would re-find the same dead pid and no-op safely (already covered by the 'no terminal artifact after reconciliation' check, since reconciliation itself doesn't write one).

This closes ACT-51's six acceptance criteria with fresh, session-observed evidence. Card ready to move to review/done.

review-code, 2026-09-08, on commit a98bcc7 (the blocking preflight-budget fix this session made and staged/committed separately, ahead of the live-run verification above).

Suite: 1228 + 100 tests green, fmt:check and lint clean, run fresh this session.

Five axes dispatched (Testing skipped, no test file in the diff): Style — nothing found. Refactoring (advisory) — nothing found. Security — nothing found, no attacker-reachable path (model is sourced only from local CLI flag/env/case-declaration in every path traced). Architecture — one note: the probe budget is a semantically-coupled-but-independent constant from sessionBudgetUsd, explicitly judged not a defect this fix should address (fixed-shape probe with a fixed tiny prompt is a different sizing problem than a per-case session budget). No action.

Spec — one should-fix, verified and disposed as tracked: the fix widens the threshold (5x margin over the one measured cold-cache failure) but doesn't close the mechanism — probeModelAvailable still can't distinguish a budget_exhausted rejection from a genuine model-unavailable rejection, both arriving as is_error: true. A colder cache or a future pricier model reproduces the same false 'model not available' report, just at a higher dollar figure. terminal_reason was present in the observed envelope and is unused. Disposition: tracked as ACT-121 rather than expanded in place — the $0.1 stopgap has real margin and closes the immediate false-rejection bug that blocked this card's live-run work; the mechanism-level fix is itself scope growth on a fix that was already outside ACT-51's directed scope, so it goes on its own card rather than widening this one further.

Oversight finding, 2026-09-08, from the iterate session, on the live evidence the build produced. Not blocking the move to Review, but review must dispose of it.

The live run's events are real and I confirmed them directly, reading .benchmark-runs/run-events.sqlite: run 2026-09-08T14-59-44.459Z recorded turn-completed at 0.290 USD / 57.6s, turn-completed at 1.031 USD / 261.5s, stage-started at 261.7s, run-interrupted at 261.7s. Real spend, monotonic elapsed, ending interrupted. AC #1, #2, #3 are genuinely evidenced.

The defect: 'stage-started' does not mark a stage starting. It is emitted from writePendingStage (src/benchmark/run-abort.ts:199), which runs once the stage's work is done and its transcript is being handed to the judge. That is why the live sequence shows two turn-completed events for the shape stage *before* shape's own stage-started. The other stage event, stage-completed (line 247), fires when the judge finishes. So both stage events mark the end of a stage's work, and nothing is emitted when a stage begins.

Why it matters for this card specifically: AC #2 promises a monitor showing 'the current stage name ... updating at each stage transition'. A watcher attaching mid-run learns which stage is running only once that stage is already over. On the first stage of a run there is no stage event at all until the work finishes, so the monitor cannot name the running stage during the longest part of the run, which is the screen's whole purpose. The criterion passed on its literal text because turn-completed carries a stage field, not because the stage-transition signal works as named.

Two ways out, for review to choose: emit a real stage-started where a stage's work begins and rename the current one to something true (stage-judging, say), or keep one event and rename it, accepting that the monitor derives the running stage from turn-completed. The first matches what the design's live monitor shows.

Probe that would settle either: start a run, attach SSE before the first stage finishes, and read whether any event names the running stage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All six acceptance criteria closed with fresh, session-observed evidence against a real rehearsal run --model sonnet --case audit-log, launched as its own process alongside a second rehearsal serve instance on PORT=4210 (never touching Joao's pre-existing instances).

AC #1-#2: a second process (curl against the SSE endpoint) received run-event records live, in flight, before any terminal record existed — three events observed in one stream (turn-completed $0.29/57.6s, turn-completed $1.03/261.5s, stage-started $1.03/261.7s), stage/spend/elapsed all changing across a turn boundary and a stage transition.

AC #3: kill -9 against the real running rehearsal process, then a restart of the PORT=4210 server instance, left the run's status as INTERRUPTED (not FAILED) via the startup reconciliation pass, read back through a second curl against /api/runs.

AC #4-#6: confirmed via direct file reads — no console.log in src/benchmark/ touches stage progress (12 remaining sites are baseline-check labels, paths, and judge/artifact output); run-abort.ts's graceful-kill path is unchanged; GLOSSARY.md carries both terms; INTERRUPTED reaches its two correct readers (server/run-history.ts, client's run-status switch) without being added to the graded-artifact types that require a grade an interrupted run never earns.

Blocking defect found and fixed before the live run could proceed (own commit, a98bcc7): probeModelAvailable's $0.02 model-probe budget rejected a real cold-cache invocation ($0.021876 measured) as budget_exhausted and misreported it as 'model unavailable'. Widened to $0.1. code-review run on that fix: Style/Refactoring/Security nothing found, Architecture one note (not a defect), Spec one should-fix (the fix raises the threshold but doesn't distinguish budget_exhausted from a genuine rejection) — tracked as ACT-121 rather than expanded here, since it's a mechanism-level fix on a change already outside this card's directed scope.

Full suite green throughout (1228 + 100 tests), lint, lint:css, fmt:check, typecheck all clean, re-run fresh after every change this session.

Not verified: sub-turn/mid-turn granularity (explicitly out of scope, ACT-96-100) and restart-survival of live progress (explicitly not required, per Joao's answer 7). Card ready for review.
<!-- SECTION:FINAL_SUMMARY:END -->
