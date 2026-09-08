---
id: ACT-51
title: 'let a run in flight be watched, which nothing on disk allows today'
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-08 12:59'
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
- [ ] #1 A second process (e.g. curl against the server's SSE endpoint) receives a run-event record while a real run is in flight, before that run writes its terminal record
- [ ] #2 That SSE stream, read against a real run, shows the current stage name, spend against the run's cost ceiling, and elapsed wall time updating at each stage transition and each turn boundary
- [ ] #3 kill -9 against a running rehearsal process, followed by a server restart, leaves that run's status as INTERRUPTED (not FAILED) in the record a reader sees, via the startup reconciliation pass
- [ ] #4 grep for console.log across src/benchmark/ (the 14 sites from ACT-26.7) returns none touching stage progress; the SIGINT/SIGTERM/SIGHUP path in run-abort.ts still writes FAILED for a graceful kill, unchanged
- [ ] #5 GLOSSARY.md gains 'run event' and 'interrupted run' entries in the wording decision-3/this card's answers gave; no lint/lint:css failure and no new raw value or component outside the design system (decision-2)
- [ ] #6 contracts.ts's run-status union includes INTERRUPTED distinct from FAILED; every reader of that union across src/ and client/ (not just src/benchmark) is updated, including client/src/run-history/run-status.ts's switch, which today maps FAILED to the UI state 'interrupted' and falls unrecognized values to 'pending' — INTERRUPTED needs its own case rather than hitting that default; typecheck clean
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
<!-- SECTION:NOTES:END -->
