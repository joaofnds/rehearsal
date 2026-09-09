---
id: ACT-98
title: record a per-step contribution phrase toward the task's final grade
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 16:22'
labels: []
dependencies:
  - ACT-49
priority: low
ordinal: 94008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's task graph node and Contribution run-detail layout show a short phrase per step describing what it contributed toward the final artifact ('brief the later steps read', 'named 2 files to touch', 'contribution pending', 'not started'). Nothing in StageJudgeInput, StageScorecard, or StageJudgeRecord (contracts.ts) records any such phrase; it does not exist in any form today. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each recorded step carries a short phrase describing its contribution toward the task's final artifact, or a stated reason none exists (queued, not started)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. Contribution phrases are a presentation aid with no scheduled consumer and no current correctness cost.

Evidence: No contribution field exists in StageScorecard, StageJudgeRecord, server responses, or client models at HEAD.

Unresolved claims/resources: Contribution layout is not scheduled.; It is unsettled whether the phrase is derived or agent-produced.

Next action: Reconsider when the Contribution layout is scheduled, then choose derivation versus generated evidence.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
