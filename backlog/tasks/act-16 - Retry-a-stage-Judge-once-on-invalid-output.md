---
id: ACT-16
title: Retry a stage Judge once on invalid output
status: Shape
assignee: []
created_date: '2026-08-30 23:30'
updated_date: '2026-08-31 05:15'
labels: []
dependencies: []
ordinal: 8008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stage Judge that returns schema-valid output with an invalid evidence citation (or otherwise fails validation in validateStageJudgeEvidence/deriveStageGrade) currently kills the whole run as STAGE_JUDGE_FAILED, discarding a paid engineering session (observed 2026-08-31: shape stage succeeded, Judge cited task-state:task.status, run died). Add one retry of the Judge call against the same frozen input before declaring STAGE_JUDGE_FAILED, recording both attempts and their costs in the stage file. Same consideration for the final Judge in judge.ts.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaping started 2026-08-31.

Repository facts observed:
- runStageJudge already retries one output-validation rejection, quotes the rejection into the second prompt, and sums both call costs (commit 59ceacb). It does not retain per-attempt responses, validation results, or costs.
- A second invalid stage response becomes STAGE_JUDGE_FAILED, whose stage file currently retains only the final error and frozen input.
- runJudge performs no retry and the main run artifact is first created only after a valid final grade.
- The existing retry covers structured-output parsing, evidence validation, and grade derivation. Command, timeout, and Claude-envelope failures are outside the retry boundary.

Open decisions:
1. Whether the final Judge gets the full durability contract, including a FAILED main run artifact after two invalid responses, or only a retry.
2. Whether each Judge attempt retains its returned output, or only cost and validation outcome.

Settled from the task wording:
- Retry only output rejected by harness validation; transport, timeout, and Claude session failures are not retried.
- The second prompt uses the same frozen evidence and rubric plus the first rejection reason.
- Existing aggregate Judge cost fields remain the sum across calls for current consumers.
- Existing stage and run artifacts remain readable.
<!-- SECTION:NOTES:END -->
