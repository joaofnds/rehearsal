---
id: ACT-26.7
title: >-
  route harness progress to stderr so run --json and replay --json emit only the
  record
status: Shape
assignee: []
created_date: '2026-09-02 21:36'
updated_date: '2026-09-09 16:33'
labels: []
milestone: m-6
dependencies: []
parent_task_id: ACT-26
priority: low
ordinal: 29008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
run and replay still mix harness diagnostics into stdout; current source has fewer sites than the card says and workflow.ts is no longer one of them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal run --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the run artifact's own bytes
- [ ] #2 `rehearsal replay --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the replay record's own bytes
- [ ] #3 `rehearsal run` without `--json` prints only the run artifact path on stdout; every progress line, agent turn, and grade appears on stderr
- [ ] #4 `rehearsal replay` without `--json` prints only the replay record path on stdout, with the same stderr rule
- [ ] #5 Harness diagnostics use the caller’s injected writer and do not write directly to stdout; run/replay JSON subprocess checks observe the data-only stream (ACT-26.7 original stdout contract and AC1-4/6; doc-61 current console.log search)
- [ ] #6 A test spawns `rehearsal run` past its gate with a faked provider and asserts stdout holds only the record, proving the rule without a paid session
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, assigned to m-4 and no longer merely a refactor. Decision-3 puts run events into SQLite behind an SSE stream, and this card is what gets harness progress off stdout so it has somewhere better to go. ACT-51 lands on top of it. The earlier note ranking this last was written when nothing consumed the harness's output programmatically; the UI does.

Triage 2026-09-09: two facts in the description are now stale, measured this run.

Count: the card says '17 console.log sites in src/benchmark/'. There are 11, by 'grep -rn console.log src/benchmark/ | wc -l'. By file: run.ts 8, calibration.ts 1, checks.ts 1, target.ts 1.

Named sites: the card says 'workflow.ts prints every agent turn on both the run and replay paths'. src/benchmark/workflow.ts exists and contains no console.log at all. Whatever moved those turns off fd 1 is already done, uncredited to this card. The three run.ts lines the card names (Target:, Original commit:, Workflow backup:) were not individually re-verified this run; only the counts and the workflow.ts absence were.

Two of the eleven are 'log: console.log' passed as an injected writer (calibration.ts:519, run.ts:1144), which is the shape AC#5 asks the other nine to take, so the work left is smaller than eleven raw prints suggests. AC#5 as written ('grep returns no match') would still fail on those two injection sites, so whoever builds this should decide whether AC#5 means no direct prints or literally no occurrences, and say which.

Also stale, in the notes: 'ACT-51 lands on top of it.' ACT-51 is Done as of this run, shipped without this card. So the dependency that note asserts did not hold, and this card is not blocking anything that has already shipped.

Priority left Low as the writer set it. It is m-6's only open card, so m-6 stands at 1 of 2 and this is what closes it.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: low. Direct harness progress still contaminates stdout, but the recorded count and workflow.ts claim are stale.

Evidence: At 1d02c8e, rg found direct console.log calls in run.ts, checks.ts and target.ts plus injected defaults; workflow.ts has none.

Unresolved claims/resources: None for the next action.

Next action: Shape the injected diagnostic writer boundary against current AC5, preserving data-only stdout behavior and allowing injected defaults.

Record: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
