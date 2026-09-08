---
id: ACT-51
title: 'let a run in flight be watched, which nothing on disk allows today'
status: Review
assignee:
  - '@claude'
created_date: '2026-09-04 13:01'
updated_date: '2026-09-08 16:09'
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
Code review (review-code skill), 2026-09-08. Diff range 496fedb..70b8531.
Suite: 1238+100 tests pass, 0 fail; typecheck, lint, fmt:check all clean
(fresh run this session).

Six axes ran (Spec, Style, Architecture, Security, Testing, Refactoring),
one unprimed reviewer agent per axis, all changed files examined. Every
finding verified against the code directly (not relayed from the
reviewer's account) before disposal.

Blocking, fixed (commit 9499293): openRunEventStore set no busy_timeout,
so a concurrent open (CLI run vs. server's SSE route vs. its startup
reconciliation, all against one shared run-events.sqlite file) threw
SQLITE_BUSY immediately. Reproduced live: 5 concurrent opens on a fresh
file threw in 4 of 5 attempts; 5s busy_timeout brought 5 trials of 8
concurrent opens to 0 failures.

Blocking, fixed (commit 7b824c1): completeArtifact/writeFailedArtifact
in run-abort.ts recorded the terminal run-event and set
terminalEventRecorded before attempting the authoritative artifact
write. A write failure after a successful record left the event stream
showing run-completed/run-failed while the artifact write it was
supposed to describe never landed, and markAborted's own guard then
skipped the corrective run-failed event because the flag was already
set. Every runEvents.record call in the file is now wrapped in a
recordRunEvent helper that reports and swallows a failure rather than
propagating it, and the terminal writes now happen before their event
is recorded.

Should-fix, fixed (commit 2b9af4c): the SSE run-events route leaked an
unredacted filesystem error verbatim to the client on a store-open
failure, bypassing the redactAbsolutePaths convention every other route
in api.ts follows. Reproduced with a read-only runs directory. Now
wrapped in its own try/catch and redacted before writing the SSE error
frame.

Should-fix, fixed (folded into 9499293): run-events.ts read a SQLite
row's kind column straight into the RunEventKind union with no runtime
check, unlike every other on-disk boundary in this diff (target.ts's
readRunMarker, manifest.ts's loadRunManifest both parse). Now validated
through a zod schema on read.

Should-fix, fixed (commit 131259f): a test in run.test.ts pinned its
"before its session runs" claim with an expect() buried inside the
runEvents.record fake's callback, invisible from the test's final
assertion block. Moved to a snapshot asserted once at the end.

Should-fix, tracked as a note rather than fixed this pass: a data clump
(runEvents/elapsedMs threaded as an unnamed pair across four interfaces
in run-abort.ts, run.ts, workflow.ts, with the same rationale comment
duplicated twice) — real duplication, Introduce Parameter Object is the
fix, but touches four interfaces' worth of call sites and test fixture
construction; deferred rather than risked under time pressure after the
blocking fixes. Worth a follow-up if this area of the code churns again.

Note, found live while verifying the SSE redaction fix, not owned by
this change (predates it, applies identically to four other routes
already calling it): redactAbsolutePaths's regex requires a path to be
preceded by whitespace, start-of-string, or an opening paren, so a path
quoted with a single-quote (the shape Node's fs errors use, e.g. EROFS:
..., mkdir '/path') is not redacted. Confirmed: redactAbsolutePaths("EROFS:
read-only file system, mkdir '/private-nope-dir-xyz'") returns the
message unchanged. Flagging for Joao to decide whether it's worth a
follow-up card.

Refactoring axis's two other should-fix-adjacent findings (Shotgun
Surgery from threading INTERRUPTED across contracts/client/glossary; a
4-positional-argument record() call where two same-typed number
arguments could transpose silently) were reviewed and left as notes:
the first is already mitigated by an extracted manifestBackedIdentity
helper, the second is Style's territory and not actioned here.

All fixes verified: full suite, typecheck, lint, fmt:check all green
after every commit; the SQLite contention fix and the SSE redaction fix
were each reproduced directly (not just re-run through the test suite).

Correction, 2026-09-08, iterate session: the review session recorded that 'backlog task files aren't tracked in this git repo' and skipped committing on that basis, leaving the card dirty. That is false. git ls-files --error-unmatch on this card's own path returns it as tracked, and every card edit in this iteration has been committed. The project's CLAUDE.md says to record backlog changes through the backlog CLI, which is about how the file is written, not about whether it is version-controlled. Committed here.

Verified independently after the review's five fixes: typecheck clean on both tsconfigs, oxlint clean, 1338 tests passing (1238 + 100, 0 fail). All six acceptance criteria are checked.
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
<!-- SECTION:FINAL_SUMMARY:END -->
