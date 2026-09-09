---
id: ACT-147
title: regrade preserved session evidence without another model run
status: To Do
assignee: []
created_date: '2026-09-09 15:49'
labels: []
dependencies:
  - ACT-145
references:
  - src/benchmark/session-record.ts
  - src/benchmark/session-check.ts
  - src/benchmark/session-attempt.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 143008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Incorrect checks should not force another paid session. Re-evaluate saved replies, transcripts and post-session state against a selected check definition while preserving the original assessment. Bind each new assessment to the saved attempt evidence and grader identity; comparison must reject mixed grading definitions.

This task consumes saved state from the state-grading card and can land before session comparison. A grading pass must not modify that state. Existing attempts may have only reply/transcript evidence: permit checks for which evidence exists and explicitly refuse unavailable state checks instead of reconstructing output by rerunning setup or the model. Resumed transcript checks must retain the original behavior boundary. First verification target: correct an intentionally wrong scorer, regrade the saved state twice, and assert zero provider invocations and unchanged source evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A corrected check definition produces a new assessment from an existing attempt’s saved evidence without invoking a model (João’s approved session benchmark scope, doc-59)
- [ ] #2 Regrading preserves the original assessment and records the new grader identity and source evidence identity (João’s approved session benchmark scope, doc-59)
- [ ] #3 Repeated grading does not alter the saved reply, transcript, files or git state (João’s approved session benchmark scope, doc-59)
- [ ] #4 An older attempt missing required state evidence is reported as unavailable for those checks instead of receiving a fabricated grade (João’s approved session benchmark scope, doc-59)
- [ ] #5 A resumed session is regraded against the original behavior-under-test boundary rather than counting its transcript prefix (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->
