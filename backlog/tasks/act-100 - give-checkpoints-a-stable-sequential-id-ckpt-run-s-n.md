---
id: ACT-100
title: 'give checkpoints a stable sequential id, ckpt-<run>-s<n>'
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
ordinal: 96008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design shows checkpoint ids in the form ckpt-0148-s1 throughout the graph, step modal, and record ledger. The harness keys a checkpoint by its run and stage name only (run-layout.ts checkpointDirectory(stage), checkpoint.ts CheckpointRecord), with no sequential per-run id of this shape recorded or derivable without also knowing the stage's position in the pipeline. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A checkpoint record carries or can be rendered as a stable id in the ckpt-<run>-s<n> form, n being the stage's 1-based position in its pipeline
<!-- AC:END -->
