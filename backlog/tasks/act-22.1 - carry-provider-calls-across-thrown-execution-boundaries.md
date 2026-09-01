---
id: ACT-22.1
title: carry provider calls across thrown execution boundaries
status: To Do
assignee: []
created_date: '2026-09-01 14:48'
labels: []
dependencies: []
references:
  - src/benchmark/workflow.ts
  - src/benchmark/judge-attempt.ts
  - src/benchmark/replay-confirmation.ts
  - src/benchmark/pipeline-confirmation.ts
parent_task_id: ACT-22
type: bug
ordinal: 19008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provider-call histories remain local when a worker or Judge throws after earlier calls produced evidence. Carry the accumulated calls on typed execution failures so confirmation records retain observed metrics and add one explicit missing call for the invocation that failed before returning evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A worker whose first provider response has metrics and whose later invocation or response processing fails produces diagnostic confirmation evidence that retains the first call and marks the failed call missing.
- [ ] #2 A Judge whose first response is rejected with metrics and whose retry invocation fails exposes both ordered provider calls: the rejected call with metrics and one missing call.
- [ ] #3 Replay confirmation whose worker and Product Owner completed with provider calls before an ordinary stage-Judge invocation failure retains both histories, adds one missing stage-Judge call, and reports the rep metrics as MISSING.
<!-- AC:END -->
