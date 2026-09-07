---
id: ACT-105
title: surface wall-clock duration per step and per run
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-07 16:33'
labels: []
dependencies:
  - ACT-49
ordinal: 101008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design shows wall-clock elapsed time per step (session pane meta '4m02s') and per run (status bar '06:12', run detail meta '6m12s'). claudeCallMetricsSchema already records durationMs and apiDurationMs per provider call (contracts.ts), so a per-step or per-run total is a sum over providerCalls, but no field aggregates it today; StageTranscript and RunArtifactEvidence carry costUsd totals but no duration total. Filed from ACT-49's design-vs-harness inventory.

Both fields are optional on ClaudeCallMetrics (contracts.ts:188-189), tracing back to duration_ms/duration_api_ms being optional on the provider envelope (claudeEnvelopeSchema, contracts.ts:198-199). A provider call missing the field must not silently drop out of the sum as if it were zero; the aggregate needs an explicit policy for a partial chain (mark the total incomplete) rather than reporting a number indistinguishable from a complete one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A step's record carries its total wall-clock duration, summed from its provider calls
- [ ] #2 A run's record carries its total wall-clock duration
- [ ] #3 A chain with one or more provider calls missing durationMs produces a total marked incomplete, never a number indistinguishable from a complete sum
<!-- AC:END -->
