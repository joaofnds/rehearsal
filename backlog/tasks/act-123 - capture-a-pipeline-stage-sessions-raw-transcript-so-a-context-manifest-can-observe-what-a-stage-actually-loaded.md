---
id: ACT-123
title: >-
  capture a pipeline stage session's raw transcript, so a context manifest can
  observe what a stage actually loaded
status: To Do
assignee: []
created_date: '2026-09-08 17:21'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: low
type: task
ordinal: 119008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Preserve a pipeline stage session’s raw transcript as run evidence so a later pipeline context manifest can observe actual reads. StageTranscript currently retains parsed exchanges/sessionId; runWorkflowStage does not retain raw JSONL. Session attempts already retain it in recordAttempt. This card provides capture, evidence location and an explicit unavailable state; downstream pipeline-manifest presentation remains later work, as ACT-61’s shaping record specifies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A completed pipeline stage retains its available raw session transcript with a location reachable from the stage/run evidence (ACT-61 shaping gap and ACT-123 original capture request; existing session recordAttempt capture behavior)
- [ ] #2 A stage whose provider supplies no raw transcript records that evidence as unavailable rather than claiming its parsed exchanges are the raw transcript (ACT-61 observed-manifest requirement; current StageTranscript limitation recorded on ACT-123)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. Raw pipeline transcripts enable observed context, but the card has no acceptance criteria, retention contract, or downstream pipeline-manifest owner.

Evidence: StageTranscript stores parsed exchanges/sessionId only; raw JSONL copying exists in session-attempt.ts and not in workflow.ts, run.ts, or checkpoint.ts.

Unresolved claims/resources: Destination, immutability, retention, failure handling, and consuming outcome are unset.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Write observable capture/cleanup acceptance and identify or file the pipeline observed-manifest consumer before build.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
