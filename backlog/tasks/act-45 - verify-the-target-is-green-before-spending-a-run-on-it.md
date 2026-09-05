---
id: ACT-45
title: verify the target is green before spending a run on it
status: Build
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 20:50'
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
- [ ] #1 A run whose target fails its own declared checks at baseline refuses before any provider call, and names the failing check
- [ ] #2 The refusal is distinguishable by the operator from a target that is green, without reading the harness source
- [ ] #3 A run that proceeds records the baseline check results in its artifact, so a later reader can tell the target was green when the run started
- [ ] #4 A baseline CommandError (thrown by runChecks from captureRunBaseline, run.ts:802) is caught where run.ts calls captureRunBaseline and re-thrown as a RefusedPreconditionError (exitCode 3), naming the failing command and its exit code in the message
- [ ] #5 Running the harness against a target whose declared check fails at baseline exits 3 and prints the failing command, observed by running the CLI against a target seeded to fail one declared check
- [ ] #6 Running the harness against a target whose declared check throws for an unrelated reason (e.g. a bug in run.ts before or after the baseline call) still exits 1, so exit code alone tells the operator which side of the baseline the failure is on
- [ ] #7 captureRunBaseline returns a LocalCheckResult for the baseline checks (PASS with the same evidence shape captureTreatmentChecks produces) and RunManifestInputs/buildRunManifest/writeRunManifest carry it into the run manifest written at run.ts:880, before seedTaskBoard
- [ ] #8 Reading the manifest of a completed run shows a baseline LocalCheckResult with status PASS, observed by running the harness against a green target and inspecting the written manifest file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape session, 2026-09-05.

Goal: a red target baseline stops the run with a refusal an operator can tell
apart from a crash, and a green baseline leaves a record in the manifest.

Both open questions were already settled by João before this session (see
decision entry above): exit code 3 (refusedPrecondition), no new artifact
file for a refusal, and the LocalCheckResult shape reused for a proceeding
run's manifest.

Corrected premise, probed this session: captureRunBaseline (run.ts:797) does
run before any workflow session and before any provider call. runChecks
(checks.ts:19) throws CommandError on the first failing command, which
propagates out of captureRunBaseline uncaught. A red target already stops
the run early; no money is at risk today. The card's original "costs money"
framing is wrong and the acceptance criteria above no longer say otherwise.

The actual gap, confirmed by reading the code:

1. CommandError (command.ts:9) carries the child process's raw exit code as
   `exitCode`, not one of the CLI's ExitCode values, and does not implement
   CommandFailure. exitCodeFor (cli/exit-codes.ts:18) falls through to
   executionFailure (1) for it, identically to an unrelated bug. A red
   baseline and a crash in harness code are indistinguishable from the exit
   code or from stderr today. This is AC #1/#2.

2. captureRunBaseline (run.ts:797) returns only baselineHashes and
   baselineContext. Nothing captures that the baseline checks passed.
   RunManifestInputs (run.ts:144) has no field for it, and writeRunManifest
   is called at run.ts:880 with no check-result data. A green run leaves no
   record that the target was green when it started. This is AC #3.

Approach (only one sane way to build it, no survey needed):

- Where run.ts calls captureRunBaseline (run.ts:858), catch the CommandError
  it can throw and re-throw as RefusedPreconditionError (cli/interactive-
  stdin.ts:5 is the existing pattern; this needs its own throw site, not
  reuse of that exact function), with a message naming the command and exit
  code from the CommandError. RefusedPreconditionError already implements
  CommandFailure and already maps to exit code 3 via exitCodeFor, so no new
  exit code plumbing.
- Change captureRunBaseline's runChecks call to run through the same
  try/catch shape captureTreatmentChecks (checks.ts:40) already uses, so it
  returns a LocalCheckResult instead of throwing on success, and add a
  baselineChecks field to RunManifestInputs/buildRunManifest, threaded into
  the object passed to writeRunManifest at run.ts:880. On failure it still
  throws (converted to RefusedPreconditionError per above) rather than
  returning FAIL, since a red baseline refuses rather than proceeds.

First test to write: a unit test on captureRunBaseline (or the call site in
run.ts, whichever the existing test file covers) asserting that a failing
baseline check surfaces as a RefusedPreconditionError with exitCode 3 and a
message containing the failing command, using a fake runChecks/dependency
injection consistent with how captureRunBaseline already takes a
dependencies object.

No glossary terms added; LocalCheckResult, captureRunBaseline, and
RefusedPreconditionError are existing terms, none renamed.

Ready for build.
<!-- SECTION:NOTES:END -->
