---
id: ACT-123
title: >-
  capture a pipeline stage session's raw transcript, so a context manifest can
  observe what a stage actually loaded
status: To Do
assignee: []
created_date: '2026-09-08 17:21'
updated_date: '2026-09-08 23:15'
labels: []
dependencies: []
priority: medium
type: task
ordinal: 119008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Filed from ACT-61's shaping session, 2026-09-08. A session-case attempt's raw
Claude session transcript is copied out of the projects directory into the
attempt record (session-attempt.ts:315-318, recordAttempt), which is what lets
ACT-59's observedManifest parse it for Read/Skill/output-style records.

A pipeline stage session has no equivalent. Verified directly: StageTranscript
(contracts.ts:243-249) carries only the parsed exchanges a stage turn produced,
never the raw .jsonl. workflow.ts's runWorkflowStage reads each turn's
structured envelope and pushes it into exchanges; the session id is kept
(sessionId field) but nothing uses it to locate or copy the underlying
transcript file Claude Code writes under its own projects directory. No
.jsonl handling exists anywhere in workflow.ts, run.ts, or checkpoint.ts
(grep confirms zero hits).

Consequence: "observed from transcript" is structurally unreachable for a
pipeline stage today, so ACT-61's context-manifest work (session-case
attempts only) cannot cover "the documents a stage reads off a card," the
third bullet of its own card description, without this capture existing
first. This card is that prerequisite: capture a stage session's raw
transcript the way session-attempt.ts already does, so a later card can
extend context-manifest.ts's observation to pipeline-stage attempts.

Not scoped here: what the pipeline-stage manifest itself reports once the
transcript is capturable — that is downstream work, filed separately once
this lands.
<!-- SECTION:DESCRIPTION:END -->
