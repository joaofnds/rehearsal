---
id: ACT-26.7
title: >-
  route harness progress to stderr so run --json and replay --json emit only the
  record
status: To Do
assignee: []
created_date: '2026-09-02 21:36'
updated_date: '2026-09-03 13:07'
labels: []
dependencies: []
parent_task_id: ACT-26
priority: low
ordinal: 29008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The card's stdout rule is that stdout carries data only and stderr everything else, so a caller can pipe one into a parser. `compare` honors it. `run` and `replay` do not: 17 `console.log` sites in `src/benchmark/` write harness progress to fd 1, so `rehearsal run --json > artifact.json` produces a file that is not parseable JSON.

The sites predate ACT-26.1 and were left alone there because moving all 17 is a harness-wide change, not CLI wiring. The known ones: `run.ts` prints `Target:`, `Original commit:`, and `Workflow backup:` before any provider call, the grade JSON, and the artifact and review paths; `workflow.ts` prints every agent turn on both the run and replay paths; `checks.ts`, `target.ts`, and `calibration.ts` each print progress.

Why: an agent that pipes `--json` into a parser gets a stream with harness prose interleaved through the record. That is the case the CLI exists to serve, and it is the last part of the stdout rule that is still untrue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal run --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the run artifact's own bytes
- [ ] #2 `rehearsal replay --json` with stdout redirected to a file produces a file whose whole contents `JSON.parse` accepts and that equals the replay record's own bytes
- [ ] #3 `rehearsal run` without `--json` prints only the run artifact path on stdout; every progress line, agent turn, and grade appears on stderr
- [ ] #4 `rehearsal replay` without `--json` prints only the replay record path on stdout, with the same stderr rule
- [ ] #5 `grep -rn 'console.log' src/benchmark/` returns no match; every harness diagnostic reaches the caller through an injected writer
- [ ] #6 A test spawns `rehearsal run` past its gate with a faked provider and asserts stdout holds only the record, proving the rule without a paid session
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: the description says 17 console.log sites in src/benchmark/. `grep -rn 'console\.log' src/benchmark/ | wc -l` returns 14, across calibration.ts, workflow.ts, target.ts, checks.ts, and run.ts. The writer's count stands as written; the current fact is 14. Acceptance #5 is stated as a grep returning no match, so it is unaffected by the count.

Per decision-1, the count with its command: `grep -rn 'console\.log' src/benchmark/ | wc -l` returns 14 on 2026-09-03 (calibration.ts 1, checks.ts 1, run.ts 9, target.ts 1, workflow.ts 2). Re-run it rather than trusting either number.
<!-- SECTION:NOTES:END -->
