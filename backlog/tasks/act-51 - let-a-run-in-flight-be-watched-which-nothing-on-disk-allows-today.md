---
id: ACT-51
title: 'let a run in flight be watched, which nothing on disk allows today'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 13:01'
updated_date: '2026-09-08 16:16'
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
Code review (review-code skill), 2026-09-08, second pass. Diff: commit
beabe04 (refactor: use benchmarkRunPaths for a reconciling run's
artifact and manifest paths), the one commit on this card that landed
after the first review record above and was not covered by it.
Suite: 1238+100 tests pass, 0 fail; typecheck, lint, fmt:check all
clean (fresh run this session).

Five axes ran (Spec, Style, Architecture, Security, Refactoring;
Testing skipped, no test file in the diff), one unprimed reviewer
agent per axis, the one changed file and its named comparison files
examined. Every finding verified against the code directly before
disposal.

Spec, Style, Architecture, Security: nothing found. Confirmed
byte-identical path construction before and after (verified by
reading both path-builder expressions side by side), no behavior
change, no new coupling or traversal exposure introduced by the
refactor itself.

Note (all four axes independently): the commit message names
"run-history.ts (in this same area of the codebase)" as an existing
caller of benchmarkRunPaths for the identical purpose. The substance
is correct but the file is src/server/run-history.ts, not
src/benchmark/ as the phrasing implies. No code or action follows;
recorded so a future reader of the commit message isn't misled about
where to look.

Should-fix, fixed (commit 65c28e3): judge-agreement.ts's
historicalStageJudgeModel still hand-rolled the identical
*.checkpoints/manifest.json path beabe04's own rationale (run-layout.ts
is meant to be the only place that knows the checkpoints-directory
suffix) argues against duplicating. One sibling instance of the same
duplication survived beabe04's dedup. Now routed through
benchmarkRunPaths like every other reader. Verified: suite, typecheck,
lint, fmt:check all clean after the fix.
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

Build session (second pass), 2026-09-08: fixed the blocking defect, the stage-started naming defect, and all eight should-fix items the prior code-review found, per direction to fix and re-review in this same card. Two prior findings were not fixed: should-fix #6 (an SSE server-termination test) was investigated and left undone, disclosed as a genuine gap this test layer cannot exercise. A fresh six-axis code review of this batch then found one new blocking defect (a spurious second, empty run-failed event on the ordinary judge-failure path) via the Architecture axis; fixed and verified in its own commit before this review closed. All other axes (Spec, Style, Security, Refactoring) found no blocking or should-fix issues beyond one Testing should-fix (a new test's missing payload assertion), which was fixed and verified with a mutation test. Full suite green (1238 + 100 tests), typecheck/lint/fmt clean throughout. Card ready for Review.

A run in flight now writes durable run events a second process can watch live, and a run that dies without finishing is reconciled into a distinct interrupted outcome rather than being called a failure.

What landed: an append-only run-event store in SQLite, derived and rebuildable per decision-3, with the records on disk still authoritative; events at a stage's start, each turn's completion, each stage's completion, and every terminal outcome; an SSE endpoint serving one run's events; a startup reconciliation pass that checks whether a run's process is still alive before declaring it interrupted; and INTERRUPTED reaching every reader that renders run status. Harness stage progress no longer goes to stdout as prose, closing ACT-26.7.

Evidenced against a real run, not fixtures: run 2026-09-08T14-59-44.459Z recorded real spend and rising elapsed time, was killed with kill -9, and reconciled to INTERRUPTED after a server restart. All six acceptance criteria carry that kind of observation.

Three defects were found by oversight or review after the first build called itself done, each one a case the criteria as written would have passed: stage-started fired at the judge handoff rather than at a stage's start, so a watcher learned the running stage only once it was over; a run that failed or was stopped by hand wrote its terminal artifact without recording any event, leaving an attached client waiting forever on the ordinary exit path; and a terminal artifact write could fail while the stream still reported success. The first two are why the live test passing was not sufficient evidence on its own.

Left open elsewhere, none blocking: ACT-121 (a preflight probe that exhausts its budget reports the model as unavailable), ACT-122 (the path redactor misses the quoted form Node's fs errors use), and a data-clump refactor noted on this card.
<!-- SECTION:FINAL_SUMMARY:END -->
