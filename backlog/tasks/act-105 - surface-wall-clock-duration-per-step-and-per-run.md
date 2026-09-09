---
id: ACT-105
title: surface wall-clock duration per step and per run
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 15:52'
labels: []
dependencies:
  - ACT-49
references:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: low
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set Low this run, from unprioritized.

Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

Session benchmark scope accepted 2026-09-09 (doc-59): ACT-149 owns carrying existing total session-attempt elapsed time into comparison reports. This card retains its provider-duration aggregation scope. Coordinate duration labels and missing-evidence handling, but do not treat a provider-call sum as total attempt time or a sum of concurrent attempt durations as group makespan.

Review follow-up for shaping: AC#1 currently calls the provider-call sum total wall-clock duration. Reconcile that wording with the provider-duration scope above before implementation; ACT-149 uses total attempt elapsed time. This session leaves the existing aggregation criterion for that shaping pass rather than choosing its replacement terminology.
<!-- SECTION:NOTES:END -->
