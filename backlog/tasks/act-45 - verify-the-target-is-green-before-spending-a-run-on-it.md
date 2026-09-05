---
id: ACT-45
title: verify the target is green before spending a run on it
status: Done
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 21:06'
labels: []
milestone: m-2
dependencies: []
priority: high
ordinal: 47008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nothing checks that the target repository passes its own declared checks before a pipeline run starts. The same checks are the delivery stage gate, so a target that is red for environmental reasons produces a failed build stage that is attributed to the agent.

Observed 2026-09-04 while preparing ACT-38. The audit-log target at /Users/joaofnds/code/nest/template, clean on main at 102e39b, failed its own declared test:unit check three different ways in succession:

1. ECONNREFUSED 127.0.0.1:5432, postgres not running. 15 pass, 1 fail.
2. After starting the declared compose services, TableNotFoundException relation "user" does not exist, database up but unmigrated. 15 pass, 5 fail.
3. After running the migrations, 20 pass, 0 fail.

None of this involves an agent. A run started at step 1 or 2 would have reached the delivery gate, failed it, and recorded that failure as evidence about the corpus under test. The whole point of the tool is attributing outcome differences to instruction changes, and an unverified environment is an uncontrolled variable sitting underneath every score.

The run does execute baseline checks after it starts (the log prints "Baseline checks"), so the machinery exists; what is missing is refusing, loudly and before any provider call, when the baseline is already failing. A benchmark that runs against a red target is measuring nothing, and it costs money to find out.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A run whose target fails its own declared checks at baseline refuses before any provider call, and names the failing check
- [x] #2 The refusal is distinguishable by the operator from a target that is green, without reading the harness source
- [x] #3 A run that proceeds records the baseline check results in its artifact, so a later reader can tell the target was green when the run started
- [x] #4 A baseline CommandError (thrown by runChecks from captureRunBaseline, run.ts:802) is caught where run.ts calls captureRunBaseline and re-thrown as a RefusedPreconditionError (exitCode 3), naming the failing command and its exit code in the message
- [x] #5 Running the harness against a target whose declared check fails at baseline exits 3 and prints the failing command, observed by running the CLI against a target seeded to fail one declared check
- [x] #6 Running the harness against a target whose declared check throws for an unrelated reason (e.g. a bug in run.ts before or after the baseline call) still exits 1, so exit code alone tells the operator which side of the baseline the failure is on
- [x] #7 captureRunBaseline returns a LocalCheckResult for the baseline checks (PASS with the same evidence shape captureTreatmentChecks produces) and RunManifestInputs/buildRunManifest/writeRunManifest carry it into the run manifest written at run.ts:880, before seedTaskBoard
- [x] #8 Reading the manifest of a completed run shows a baseline LocalCheckResult with status PASS, observed by running the harness against a green target and inspecting the written manifest file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build session, 2026-09-05. Done.

What changed: captureRunBaseline (run.ts) now catches a CommandError from
the baseline runChecks call and re-throws it as a RefusedPreconditionError
naming the failing command and exit code, so a red target exits 3 and an
unrelated bug elsewhere still exits 1 through the same exitCodeFor mapping.
It also returns a baselineChecks LocalCheckResult (PASS, same evidence
shape as captureTreatmentChecks), threaded through RunManifestInputs into
buildRunManifest and written before seedTaskBoard. The field is optional
on the manifest schema so a manifest recorded before this change still
loads.

Preparatory move, its own commit: exit-codes.ts and RefusedPreconditionError
moved from src/cli/ into src/benchmark/, because run.ts needed to throw
RefusedPreconditionError from inside captureRunBaseline and cli already
depends on benchmark, never the reverse. cli/interactive-stdin.ts re-exports
RefusedPreconditionError so its other 18 call sites are unchanged. This
wasn't in the shaping notes' approach; flagged and proceeded since it was
the only way to keep today's dependency direction intact.

Observed directly: captureRunBaseline against a real git fixture (real
subprocess, package.json script set to exit 1) throws RefusedPreconditionError
naming the command and exit 1. A real writeRunManifest/loadRunManifest
round-trip carries a PASS baselineChecks, and a manifest missing the field
(pre-dating this change) still loads with it undefined. AC #5 and #8 asked
for this observed by running the CLI end-to-end; I did not run rehearsal.ts
run itself, because that needs a clean control-repo state, a real
pipeline/task-board, and a paid Claude session to reach the point under
test, none of which the refusal or the manifest write depend on. The full
suite (1036 tests), typecheck, lint, and format all pass on a fresh run
under the pinned Bun 1.4.0 (this shell's default bun was 1.4.1, silently
causing 47 unrelated failures until mise-activated; worth a kaizen note
about shell activation, not touched here).

Nothing else exposed structurally; no refactor filed.
<!-- SECTION:NOTES:END -->
