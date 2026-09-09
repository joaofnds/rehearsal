---
id: ACT-105
title: surface measured elapsed time per pipeline step and run
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 16:22'
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
Report measured elapsed time for pipeline steps and runs at their execution boundaries. A sum of provider-reported durationMs is provider time, not elapsed time; concurrent calls and harness work make them differ. Keep any provider-duration aggregate separately named and mark it incomplete when a call lacks durationMs. ACT-149 owns session-attempt elapsed-time comparisons. Preserve the original design requirement for step and run elapsed displays from ACT-49 and SPEC.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pipeline step’s record exposes measured elapsed time for that step, without labelling a sum of provider durations as wall-clock time (ACT-49 design inventory; SPEC.md step-duration display; doc-59 duration distinction)
- [ ] #2 A pipeline run’s record exposes measured elapsed time for the run, distinct from provider duration and any concurrent-repetition sum (ACT-49 design inventory; SPEC.md run-duration display; doc-59 duration distinction)
- [ ] #3 A provider-duration aggregate whose calls include missing durationMs is explicitly incomplete; absence does not become a complete zero or elapsed measurement (ACT-105 original AC3 and optional ClaudeCallMetrics fields)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

Session benchmark scope accepted 2026-09-09 (doc-59): ACT-149 owns carrying existing total session-attempt elapsed time into comparison reports. This card retains its provider-duration aggregation scope. Coordinate duration labels and missing-evidence handling, but do not treat a provider-call sum as total attempt time or a sum of concurrent attempt durations as group makespan.

Review follow-up for shaping: AC#1 currently calls the provider-call sum total wall-clock duration. Reconcile that wording with the provider-duration scope above before implementation; ACT-149 uses total attempt elapsed time. This session leaves the existing aggregation criterion for that shaping pass rather than choosing its replacement terminology.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

Title changed by triage from “surface wall-clock duration per step and per run” to “surface measured elapsed time per pipeline step and run”; the filename retains the old title.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. Provider duration is useful, but summing provider calls is not wall-clock time and conflicts with ACT-149's accepted elapsed-time scope.

Evidence: ClaudeCallMetrics has optional durationMs/apiDurationMs; no aggregate exists. Doc-59 assigns total attempt elapsed time to ACT-149.

Unresolved claims/resources: Metric name and concurrency/partial-chain policy are incorrect or unset.

Next action: Reconsider after m-7; shape measured step/run elapsed boundaries and distinct provider-duration aggregates, preserving missing-evidence semantics. Coordinate ACT-149 without replacing the pipeline elapsed outcome.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
