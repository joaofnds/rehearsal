---
id: ACT-45
title: verify the target is green before spending a run on it
status: To Do
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 20:46'
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
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision, 2026-09-05 (João, in session): both shape questions settled.

1. A red baseline refuses with exit code 3 (refusedPrecondition, already used for other pre-flight refusals) and names the failing check on stderr. No new artifact file for a run that never started, and no new exit code. João: 'agree'.

2. A run that proceeds records its baseline check results using the same LocalCheckResult shape captureTreatmentChecks already produces, so a later reader sees both ends of a run in one format. João: 'agree'.

Probed this session before relaying the shape session's claims: captureRunBaseline (src/benchmark/run.ts:802) does run before any workflow session, and runChecks throws on the first failing check, so a red target already stops the run before any provider call. The card's premise that money is at risk is wrong. The real gap is that the refusal is indistinguishable from an unrelated crash and a green baseline leaves no trace on disk.
<!-- SECTION:NOTES:END -->
