---
id: ACT-99
title: >-
  build culprit analysis: an agent opinion naming a probable stage, disclosed as
  opinion
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
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
