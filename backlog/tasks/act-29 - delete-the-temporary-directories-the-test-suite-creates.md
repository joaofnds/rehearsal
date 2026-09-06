---
id: ACT-29
title: delete the temporary directories the test suite creates
status: Done
assignee: []
created_date: '2026-09-03 00:32'
updated_date: '2026-09-06 11:57'
labels: []
milestone: m-2
dependencies: []
priority: medium
ordinal: 31008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Most test suites make their scratch directories with mkdtemp directly and never remove them, so every `bun test` run leaves hundreds behind in $TMPDIR. Observed 2026-09-03 during ACT-26.6: 817 rehearsal-attempt-record, 817 rehearsal-attempt-projects, 676 rehearsal-projects, 670 rehearsal-confirmation-failures, and more, over 1500 in total. TestResources.forEachTest() already exists and cleans up; the suites that predate it do not use it. The fix is mechanical, per file: take the directory from resources.createControlDirectory() or track() what mkdtemp returned. Found by ACT-26.6, whose own new leak (the chezmoi render, a copy of the home tree) it fixed in place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pipeline-confirmation and replay-confirmation remove their worktrees directory when the confirmation body throws
- [x] #2 every mkdtemp call in src/ has its directory removed by the test or function that created it, on both the passing and throwing path
- [x] #3 a full bun test run leaves the rehearsal-* count in $TMPDIR unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-06.

Goal: no mkdtemp call in src/ leaks its directory, whether the caller is a
test or the running harness.

The card's framing undercounts the bug. Of the 45 files calling mkdtemp
(`grep -rln 'mkdtemp' src/ | wc -l`, 2026-09-06), 12 are not tests:
attempts.ts, judge.ts, pipeline-confirmation.ts, pipeline-confirmation-test-support.ts,
replay-confirmation.ts, replay-confirmation-test-support.ts, replay.ts, run.ts,
session-attempt.ts, stage-grading.ts, target.ts, and cli/calibrate-test-support.ts.
Nine of those twelve already remove their own directory in a finally block and
are fine as they are (attempts.ts, judge.ts, replay.ts, run.ts, session-attempt.ts,
stage-grading.ts, target.ts, and the two *-test-support.ts files, which are
test-only helpers despite the missing .test.ts suffix and belong with the
mechanical batch below).

Two are a live bug, not a test artifact: pipeline-confirmation.ts:771 and
replay-confirmation.ts:382 each mkdtemp a worktrees directory and never remove
it, not even in a finally block. This leaks on every confirmation run,
including real paid runs outside `bun test`. Fix these two first, with a
finally (or try/finally around the confirmation body) that rm -rf's
worktreesDirectory; this is the part of the task with real-world cost beyond
disk noise in $TMPDIR.

The remaining ~33 files are the mechanical part the card describes: replace a
bare mkdtemp with resources.track(path) or resources.createControlDirectory(),
using a TestResources instance from TestResources.forEachTest(). TestResources
(src/benchmark/test-support.ts:37) already cleans up on both pass and throw,
because it hooks afterEach; no gap to close there. Converting every remaining
file satisfies AC #2 by construction.

No architectural unknowns and no viable second approach: mkdtemp without
cleanup is simply a bug, and TestResources is the established fix already used
by 24 files. Nothing to ask.

First test to write: a test on pipeline-confirmation (or replay-confirmation)
that forces one rep to throw and asserts the worktrees directory no longer
exists afterward. It is the one behavior with no coverage today and the one
with real cost.

Order of work: fix the two live leaks first (small, real bug, easy to verify
in isolation), then sweep the ~33 mechanical files, then verify AC #3 and #4.

Built and verified 2026-09-06.

The card called this test hygiene. Two production paths were leaking: runPipelineConfirmation and runReplayConfirmation each created a worktrees directory with mkdtemp and removed it only after every rep settled, so any throw in the body left it on disk. That happens on real runs, not only under bun test. Both now remove it on the throwing path, with a test that forces a throw and asserts the directory is gone.

The rest was the mechanical sweep the card described: the suites that made scratch directories now take them from TestResources, which removes them on pass and on throw.

A third suspected leak was investigated and is not a defect. finalizeConfirmationGroup (confirmation-evidence.ts:248) removes the worktrees directory only when no rep set preservedWorktree. A rep that fails diagnostically keeps its worktree deliberately and logs 'evidence preserved at <path>'. A directory surviving a passing run is that feature, not a leak.

Verified: bun test 1054 pass 0 fail, with the rehearsal-* count in $TMPDIR measured before and after at 1074 both times, delta 0. Lint, typecheck, and fmt:check all clean.

Rejected during the build: a custom oxlint rule (anti-slop/require-mkdtemp-cleanup) to guard future mkdtemp calls. It cannot see cleanup that happens in a sibling afterEach hook, so it fired on six correct sites. Widening it to accept any file containing afterEach would have accepted nearly everything. Removed rather than shipped.
<!-- SECTION:NOTES:END -->
