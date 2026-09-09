---
id: doc-62
title: Triage rehearsal evidence and recovery A
type: other
created_date: '2026-09-09 16:11'
updated_date: '2026-09-09 16:23'
---
# Triage recovery, 2026-09-09

Parent: doc-61. Full before/after fields, including previous verdict text. Every mutation was preceded by a fresh task-view (schemaVersion 1). Existing notes outside the prior verdict paragraph were preserved.

```json
[
  {
    "operation": "create",
    "id": "ACT-151",
    "before": null,
    "after": {
      "id": "ACT-151",
      "title": "compare existing session cases across baseline, candidate and control arms",
      "status": "To Do",
      "priority": "high",
      "assignees": [],
      "labels": [],
      "milestone": "m-7",
      "parentTaskId": null,
      "ordinal": 147008,
      "createdAt": "2026-09-09T16:15:00Z",
      "updatedAt": null,
      "description": "ACT-69 already has USD 25 authorized for two session cases, three arms and two reps. ACT-140 can produce the groups, but buildComparisonQuality still sends session reps into the pipeline final-outcome branch and throws. Deliver the smallest existing multi-case session comparison path before the generated-fixture and single-case experiment. This is an independently acceptable slice of ACT-146; that card retains its original six acceptance criteria and gains this prerequisite.\n\nLoad actual session input/evidence identities and grade their checks without inventing a pipeline final outcome. Preserve baseline/candidate/control and paired per-case uncertainty. Use provider-free recorded fixtures for this build; ACT-69 owns the paid demonstration. The session record representation must follow ACT-140. No generated fixture, new skill delivery, one-case estimator or regrading is required for this slice.",
      "dependencies": [
        "ACT-140"
      ],
      "references": [],
      "documentation": [
        "backlog/docs/doc-61 - Triage-rehearsal-backlog.md"
      ],
      "subtasks": [],
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "A manifest for two existing session cases with baseline, candidate and control groups of at least two reps produces a comparison report without a pipeline final-outcome error (ACT-69 authorized two-case session-mode run; doc-59 session comparison scope; triage session-probes reproduction in doc-61)",
          "checked": false
        },
        {
          "index": 2,
          "text": "The comparison grades session checks and identifies the source groups and repetitions without inventing a pipeline or final judge (doc-59 approved session evidence boundary)",
          "checked": false
        },
        {
          "index": 3,
          "text": "Missing control arms and mismatched shared case inputs, model, effort, settings or grading definitions are refused with the incompatible input named (doc-59 approved comparison boundary)",
          "checked": false
        },
        {
          "index": 4,
          "text": "Existing valid pipeline and stage multi-case comparisons retain their paired per-case interpretation (ACT-146 AC5, doc-59)",
          "checked": false
        },
        {
          "index": 5,
          "text": "Provider-free fixtures prove report production and loading; this implementation starts no paid experiment under ACT-69’s separate budget (ACT-69 budget boundary; doc-59 no additional spend authorization)",
          "checked": false
        }
      ],
      "definitionOfDone": [],
      "implementationPlan": null,
      "implementationNotes": null,
      "comments": [],
      "finalSummary": null
    },
    "state": "read-back verified"
  },
  {
    "operation": "create",
    "id": "ACT-152",
    "before": null,
    "after": {
      "id": "ACT-152",
      "title": "bring the operator runbook in line with shipped preflight and recorded-run behavior",
      "status": "To Do",
      "priority": "medium",
      "assignees": [],
      "labels": [],
      "milestone": "m-2",
      "parentTaskId": null,
      "ordinal": 148008,
      "createdAt": "2026-09-09T16:15:00Z",
      "updatedAt": null,
      "description": "docs/runbook.md still instructs a reader that target readiness is unchecked, stopped runs are invisible, and the harness installs its own project instructions into the target. ACT-45, ACT-44 and ACT-41 delivered those behaviors; current preflight and list/read paths confirm them. The runbook also hardcodes a local target path and an old case count. Correct this existing operator guide from current commands before a second person follows obsolete workarounds. Keep observed historical run costs explicitly dated and distinguish residual limitations from resolved incidents. The separate ACT-84 owns Bun entry-point enforcement.",
      "dependencies": [],
      "references": [],
      "documentation": [
        "backlog/docs/doc-61 - Triage-rehearsal-backlog.md"
      ],
      "subtasks": [],
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "The guide describes current preflight checks and stopped-run discovery and removes workarounds for resolved ACT-41, ACT-44 and ACT-45 defects (docs/runbook.md sections 3-4 and What is not yet true; completed cards and current source inspected in triage)",
          "checked": false
        },
        {
          "index": 2,
          "text": "The guide discovers case targets and available cases through current declarations/commands instead of requiring the original operator’s absolute path or an undated count (docs/runbook.md current hardcoded path/count; ACT-34 portable target outcome)",
          "checked": false
        },
        {
          "index": 3,
          "text": "Every documented read-only command is checked against the current CLI, and paid examples keep explicit cost and prerequisite information (project CLAUDE.md command convention; docs/runbook.md purpose)",
          "checked": false
        }
      ],
      "definitionOfDone": [],
      "implementationPlan": null,
      "implementationNotes": null,
      "comments": [],
      "finalSummary": null
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-26.7",
    "evidence": "At 1d02c8e, rg found direct console.log calls in run.ts, checks.ts and target.ts plus injected defaults; workflow.ts has none.",
    "before": {
      "description": "The card's stdout rule is that stdout carries data only and stderr everything else, so a caller can pipe one into a parser. `compare` honors it. `run` and `replay` do not: 17 `console.log` sites in `src/benchmark/` write harness progress to fd 1, so `rehearsal run --json > artifact.json` produces a file that is not parseable JSON.\n\nThe sites predate ACT-26.1 and were left alone there because moving all 17 is a harness-wide change, not CLI wiring. The known ones: `run.ts` prints `Target:`, `Original commit:`, and `Workflow backup:` before any provider call, the grade JSON, and the artifact and review paths; `workflow.ts` prints every agent turn on both the run and replay paths; `checks.ts`, `target.ts`, and `calibration.ts` each print progress.\n\nWhy: an agent that pipes `--json` into a parser gets a stream with harness prose interleaved through the record. That is the case the CLI exists to serve, and it is the last part of the stdout rule that is still untrue.",
      "status": "To Do",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "`rehearsal run --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the run artifact's own bytes",
          "checked": false
        },
        {
          "index": 2,
          "text": "`rehearsal replay --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the replay record's own bytes",
          "checked": false
        },
        {
          "index": 3,
          "text": "`rehearsal run` without `--json` prints only the run artifact path on stdout; every progress line, agent turn, and grade appears on stderr",
          "checked": false
        },
        {
          "index": 4,
          "text": "`rehearsal replay` without `--json` prints only the replay record path on stdout, with the same stderr rule",
          "checked": false
        },
        {
          "index": 5,
          "text": "`grep -rn 'console.log' src/benchmark/` returns no match; every harness diagnostic reaches the caller through an injected writer",
          "checked": false
        },
        {
          "index": 6,
          "text": "A test spawns `rehearsal run` past its gate with a faked provider and asserts stdout holds only the record, proving the rule without a paid session",
          "checked": false
        }
      ],
      "implementationNotes": "Triage 2026-09-04, assigned to m-4 and no longer merely a refactor. Decision-3 puts run events into SQLite behind an SSE stream, and this card is what gets harness progress off stdout so it has somewhere better to go. ACT-51 lands on top of it. The earlier note ranking this last was written when nothing consumed the harness's output programmatically; the UI does.\n\nTriage 2026-09-09: two facts in the description are now stale, measured this run.\n\nCount: the card says '17 console.log sites in src/benchmark/'. There are 11, by 'grep -rn console.log src/benchmark/ | wc -l'. By file: run.ts 8, calibration.ts 1, checks.ts 1, target.ts 1.\n\nNamed sites: the card says 'workflow.ts prints every agent turn on both the run and replay paths'. src/benchmark/workflow.ts exists and contains no console.log at all. Whatever moved those turns off fd 1 is already done, uncredited to this card. The three run.ts lines the card names (Target:, Original commit:, Workflow backup:) were not individually re-verified this run; only the counts and the workflow.ts absence were.\n\nTwo of the eleven are 'log: console.log' passed as an injected writer (calibration.ts:519, run.ts:1144), which is the shape AC#5 asks the other nine to take, so the work left is smaller than eleven raw prints suggests. AC#5 as written ('grep returns no match') would still fail on those two injection sites, so whoever builds this should decide whether AC#5 means no direct prints or literally no occurrences, and say which.\n\nAlso stale, in the notes: 'ACT-51 lands on top of it.' ACT-51 is Done as of this run, shipped without this card. So the dependency that note asserts did not hold, and this card is not blocking anything that has already shipped.\n\nPriority left Low as the writer set it. It is m-6's only open card, so m-6 stands at 1 of 2 and this is what closes it."
    },
    "after": {
      "description": "run and replay still mix harness diagnostics into stdout; current source has fewer sites than the card says and workflow.ts is no longer one of them.",
      "status": "Shape",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "`rehearsal run --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the run artifact's own bytes",
          "checked": false
        },
        {
          "index": 2,
          "text": "`rehearsal replay --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the replay record's own bytes",
          "checked": false
        },
        {
          "index": 3,
          "text": "`rehearsal run` without `--json` prints only the run artifact path on stdout; every progress line, agent turn, and grade appears on stderr",
          "checked": false
        },
        {
          "index": 4,
          "text": "`rehearsal replay` without `--json` prints only the replay record path on stdout, with the same stderr rule",
          "checked": false
        },
        {
          "index": 5,
          "text": "Harness diagnostics use the caller’s injected writer and do not write directly to stdout; run/replay JSON subprocess checks observe the data-only stream (ACT-26.7 original stdout contract and AC1-4/6; doc-61 current console.log search)",
          "checked": false
        },
        {
          "index": 6,
          "text": "A test spawns `rehearsal run` past its gate with a faked provider and asserts stdout holds only the record, proving the rule without a paid session",
          "checked": false
        }
      ],
      "implementationNotes": "Triage 2026-09-04, assigned to m-4 and no longer merely a refactor. Decision-3 puts run events into SQLite behind an SSE stream, and this card is what gets harness progress off stdout so it has somewhere better to go. ACT-51 lands on top of it. The earlier note ranking this last was written when nothing consumed the harness's output programmatically; the UI does.\n\nTriage 2026-09-09: two facts in the description are now stale, measured this run.\n\nCount: the card says '17 console.log sites in src/benchmark/'. There are 11, by 'grep -rn console.log src/benchmark/ | wc -l'. By file: run.ts 8, calibration.ts 1, checks.ts 1, target.ts 1.\n\nNamed sites: the card says 'workflow.ts prints every agent turn on both the run and replay paths'. src/benchmark/workflow.ts exists and contains no console.log at all. Whatever moved those turns off fd 1 is already done, uncredited to this card. The three run.ts lines the card names (Target:, Original commit:, Workflow backup:) were not individually re-verified this run; only the counts and the workflow.ts absence were.\n\nTwo of the eleven are 'log: console.log' passed as an injected writer (calibration.ts:519, run.ts:1144), which is the shape AC#5 asks the other nine to take, so the work left is smaller than eleven raw prints suggests. AC#5 as written ('grep returns no match') would still fail on those two injection sites, so whoever builds this should decide whether AC#5 means no direct prints or literally no occurrences, and say which.\n\nAlso stale, in the notes: 'ACT-51 lands on top of it.' ACT-51 is Done as of this run, shipped without this card. So the dependency that note asserts did not hold, and this card is not blocking anything that has already shipped.\n\nPriority left Low as the writer set it. It is m-6's only open card, so m-6 stands at 1 of 2 and this is what closes it.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: low. Direct harness progress still contaminates stdout, but the recorded count and workflow.ts claim are stale.\n\nEvidence: At 1d02c8e, rg found direct console.log calls in run.ts, checks.ts and target.ts plus injected defaults; workflow.ts has none.\n\nUnresolved claims/resources: None for the next action.\n\nNext action: Define the injected diagnostic writer boundary and rewrite AC5 to forbid direct writes rather than every console.log token.\n\nRecord: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<backlog/docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-27",
    "evidence": "run-command.ts is 438 lines, replay-command.ts 410, and prefer-default-export is disabled.",
    "before": {
      "description": "src/cli/run-command.ts and src/cli/replay-command.ts each hold two things that change for different reasons: the command policy (parse flags, gate on a terminal, report the record) and the harness wiring (executeRun/confirmRun and executeReplay/currentControlSha, which assemble the dependency lists the harness needs and reach the provider). The policy half is unit tested with injected fakes; the wiring half cannot be tested without paid work, and it changes whenever a harness dependency list changes.\n\nSplitting it was attempted during ACT-26.1 build and reverted: the extracted run-wiring.ts and replay-wiring.ts each export one function, which oxlint's import/prefer-default-export rejects, and pairing an arbitrary second export to satisfy it would be worse than the duplication. The guard's refusal indicts that shape of the change, so the split needs a design that produces cohesive modules: either both wirings in one src/cli/harness-wiring.ts, or the dependency lists themselves extracted as named values the wiring composes.\n\nCost of leaving it: run-command.ts is 236 lines and replay-command.ts 282, most of it dependency assembly that a reader must scroll past to find the command's behavior, and a harness dependency change edits a file whose tests are about CLI contracts.",
      "priority": "medium",
      "implementationNotes": "Triage 2026-09-04, ranked against the project's goal. Stays Low, and deliberately unassigned to a milestone.\n\nThe tool has never run its own pipeline (`rehearsal list runs` empty at 540ba9a). Until m-1 produces a comparison somebody reads, internal restructuring changes nothing an operator can observe. These three are the last work to do, not the next.\n\nOne exception worth watching: ACT-26.7 becomes real the moment anything consumes `run --json` programmatically, because harness prose on stdout makes the record unparseable. If m-1's run is driven by hand and read by eye, that does not bite. If it is scripted, ACT-26.7 blocks it and should be pulled forward.\n\nTriage 2026-09-07 (second pass, 16:20): the card's stated blocker is stale. .oxlintrc.json:90 now sets import/prefer-default-export to off (commit bf90120, 2026-09-07), the exact rule the card blames for reverting the prior wiring-split attempt (extracted run-wiring.ts/replay-wiring.ts each exporting one function). That obstacle is gone; the split could be reattempted the way it was first tried. The card's underlying cost claim still holds and is worse: run-command.ts is now 424 lines (cited 236) and replay-command.ts 403 (cited 282), both grown since the card was written. Not closed; still Low and still queued behind ACT-26.7 per doc-28's bundle ordering, since it and ACT-31 share files.\n\nTriage 2026-09-08 (d): the card's basis for staying Low is now stale. Verified 2026-09-08 via rehearsal.ts list runs: a real recorded run exists (run:2026-09-06T21-58-29.508Z, audit-log, STOPPED:build, replayable), and .benchmark-runs/ holds comparisons, replays, sessions, and run-events.sqlite. The 'rehearsal list runs empty at 540ba9a' premise this card and ACT-31 were deprioritized on no longer holds. Line counts drifted further too: run-command.ts is 438 lines, replay-command.ts 406 (cited 424/403 on 2026-09-07). Priority is João's call, flagged in this run's triage doc rather than changed here.\n\nPriority 2026-09-08: Low to Medium, directed by João. The premise both this card and ACT-31 were held Low on ('the tool has never run its own pipeline') is verified false this session: rehearsal.ts list runs shows run:2026-09-06T21-58-29.508Z (audit-log, STOPPED:build, replayable). The lint rule that reverted the first split attempt is also off (.oxlintrc.json:98, import/prefer-default-export), so the shape of the original attempt is legal again. Line counts have drifted further: run-command.ts 438, replay-command.ts 406. Still queued behind ACT-26.7 per doc-28's bundle ordering."
    },
    "after": {
      "description": "Split command policy from production harness wiring; the old lint blocker and old line counts no longer apply.",
      "priority": "low",
      "implementationNotes": "Triage 2026-09-04, ranked against the project's goal. Stays Low, and deliberately unassigned to a milestone.\n\nThe tool has never run its own pipeline (`rehearsal list runs` empty at 540ba9a). Until m-1 produces a comparison somebody reads, internal restructuring changes nothing an operator can observe. These three are the last work to do, not the next.\n\nOne exception worth watching: ACT-26.7 becomes real the moment anything consumes `run --json` programmatically, because harness prose on stdout makes the record unparseable. If m-1's run is driven by hand and read by eye, that does not bite. If it is scripted, ACT-26.7 blocks it and should be pulled forward.\n\nTriage 2026-09-07 (second pass, 16:20): the card's stated blocker is stale. .oxlintrc.json:90 now sets import/prefer-default-export to off (commit bf90120, 2026-09-07), the exact rule the card blames for reverting the prior wiring-split attempt (extracted run-wiring.ts/replay-wiring.ts each exporting one function). That obstacle is gone; the split could be reattempted the way it was first tried. The card's underlying cost claim still holds and is worse: run-command.ts is now 424 lines (cited 236) and replay-command.ts 403 (cited 282), both grown since the card was written. Not closed; still Low and still queued behind ACT-26.7 per doc-28's bundle ordering, since it and ACT-31 share files.\n\nTriage 2026-09-08 (d): the card's basis for staying Low is now stale. Verified 2026-09-08 via rehearsal.ts list runs: a real recorded run exists (run:2026-09-06T21-58-29.508Z, audit-log, STOPPED:build, replayable), and .benchmark-runs/ holds comparisons, replays, sessions, and run-events.sqlite. The 'rehearsal list runs empty at 540ba9a' premise this card and ACT-31 were deprioritized on no longer holds. Line counts drifted further too: run-command.ts is 438 lines, replay-command.ts 406 (cited 424/403 on 2026-09-07). Priority is João's call, flagged in this run's triage doc rather than changed here.\n\nPriority 2026-09-08: Low to Medium, directed by João. The premise both this card and ACT-31 were held Low on ('the tool has never run its own pipeline') is verified false this session: rehearsal.ts list runs shows run:2026-09-06T21-58-29.508Z (audit-log, STOPPED:build, replayable). The lint rule that reverted the first split attempt is also off (.oxlintrc.json:98, import/prefer-default-export), so the shape of the original attempt is legal again. Line counts have drifted further: run-command.ts 438, replay-command.ts 406. Still queued behind ACT-26.7 per doc-28's bundle ordering.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: defer; next action: implementation. Priority: low. The mixed policy/wiring modules are real maintenance debt without current operator harm.\n\nEvidence: run-command.ts is 438 lines, replay-command.ts 410, and prefer-default-export is disabled.\n\nUnresolved claims/resources: ACT-26.7\n\nNext action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Extract cohesive production wiring after the output seam settles.\n\nRecord: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<backlog/docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-31",
    "evidence": "runBenchmark is a 1,166-line production-wired export and has no direct call in run.test.ts.",
    "before": {
      "description": "runBenchmark is a 292-line procedure in src/benchmark/run.ts that constructs every collaborator it uses: assertControlReady, assertSourceReady, captureWorkflowBackup, claimTarget, createProductOwner, runWorkflowStage, runStageJudge, runJudge, createRunAbort, teardownTarget. Nothing can call it without a real target repository and a provider, so it has no test.\n\nACT-26.3 met three of its acceptance criteria by extracting the decisions it needed to observe (finishGradedRun, pausesOnFailure, and the calibrateStageFailure hook) rather than by testing the run. That worked, but it means the wiring between those decisions is still unobserved: nothing checks that finishGradedRun is called with the artifact's own resultSha, or that the teardown really follows the retention ref.\n\nrunGradedStages next door takes a StageDependencies record and is fully faked in run.test.ts. The target structure is the same shape one level up: a RunDependencies record runBenchmark takes, with rehearsal.ts supplying the real ones, so a test can run the whole benchmark over fakes and observe the order of claim, grade, retain, restore.",
      "priority": "medium",
      "implementationNotes": "Triage 2026-09-04, ranked against the project's goal. Stays Low, and deliberately unassigned to a milestone.\n\nThe tool has never run its own pipeline (`rehearsal list runs` empty at 540ba9a). Until m-1 produces a comparison somebody reads, internal restructuring changes nothing an operator can observe. These three are the last work to do, not the next.\n\nOne exception worth watching: ACT-26.7 becomes real the moment anything consumes `run --json` programmatically, because harness prose on stdout makes the record unparseable. If m-1's run is driven by hand and read by eye, that does not bite. If it is scripted, ACT-26.7 blocks it and should be pulled forward.\n\nTriage 2026-09-08 (d): same stale premise as ACT-27, see that card's note of the same date. A real recorded run now exists (rehearsal.ts list runs, verified 2026-09-08), so the 'nothing an operator can observe yet' reasoning both cards were deprioritized on no longer holds as stated. Priority is João's call, flagged in this run's triage doc rather than changed here.\n\nPriority 2026-09-08: Low to Medium, directed by João, same basis as ACT-27's note of this date. The 'nothing an operator can observe yet' premise is verified false: a real replayable run exists (rehearsal.ts list runs, this session). src/benchmark/run.ts has grown to 1156 lines since the card was written."
    },
    "after": {
      "description": "Make the current runBenchmark orchestration testable with fake collaborators and pin retention before teardown.",
      "priority": "low",
      "implementationNotes": "Triage 2026-09-04, ranked against the project's goal. Stays Low, and deliberately unassigned to a milestone.\n\nThe tool has never run its own pipeline (`rehearsal list runs` empty at 540ba9a). Until m-1 produces a comparison somebody reads, internal restructuring changes nothing an operator can observe. These three are the last work to do, not the next.\n\nOne exception worth watching: ACT-26.7 becomes real the moment anything consumes `run --json` programmatically, because harness prose on stdout makes the record unparseable. If m-1's run is driven by hand and read by eye, that does not bite. If it is scripted, ACT-26.7 blocks it and should be pulled forward.\n\nTriage 2026-09-08 (d): same stale premise as ACT-27, see that card's note of the same date. A real recorded run now exists (rehearsal.ts list runs, verified 2026-09-08), so the 'nothing an operator can observe yet' reasoning both cards were deprioritized on no longer holds as stated. Priority is João's call, flagged in this run's triage doc rather than changed here.\n\nPriority 2026-09-08: Low to Medium, directed by João, same basis as ACT-27's note of this date. The 'nothing an operator can observe yet' premise is verified false: a real replayable run exists (rehearsal.ts list runs, this session). src/benchmark/run.ts has grown to 1156 lines since the card was written.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: defer; next action: implementation. Priority: low. runBenchmark production wiring remains untested, but no active behavior failure is recorded.\n\nEvidence: runBenchmark is a 1,166-line production-wired export and has no direct call in run.test.ts.\n\nUnresolved claims/resources: ACT-26.7\n\nNext action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Inject RunDependencies and drive one full no-pause run with fakes.\n\nRecord: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<backlog/docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  }
]
```
