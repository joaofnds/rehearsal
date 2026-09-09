---
id: ACT-99
title: >-
  build culprit analysis: an agent opinion naming a probable stage, disclosed as
  opinion
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 13:01'
labels: []
dependencies:
  - ACT-49
priority: low
ordinal: 95008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's Contribution run-detail layout has an agent read the recorded steps of a stopped or completed run and name a probable culprit stage, with its own cost/duration/timestamp and a per-step role (not implicated / contributing / primary culprit / never ran), explicitly disclosed as one agent's reading rather than a measurement. This does not exist in any form in the harness today: there is no code path that runs an agent over a completed run's recorded evidence to produce this kind of output. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Given a run's recorded evidence, an agent call produces a named probable-culprit stage with a narrative, its own cost, duration, and timestamp
- [ ] #2 Every step in the run is labeled with one of: not implicated, contributing, primary culprit, never ran
- [ ] #3 The output is stored and rendered labeled as an opinion, never as a grade or a measurement
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set Low this run, from unprioritized.

Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.
<!-- SECTION:NOTES:END -->
