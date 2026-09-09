---
id: ACT-100
title: 'give checkpoints a stable sequential id, ckpt-<run>-s<n>'
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 16:22'
labels: []
dependencies:
  - ACT-49
priority: low
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. Stable checkpoint labels help cross-screen navigation, but the value can likely be derived without schema growth.

Evidence: run-layout keys checkpoint directories by stage name; no ckpt-<run>-s<n> field exists, while pipeline order makes n derivable.

Unresolved claims/resources: Persistence versus render-time derivation is unset.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Check every consumer and prefer a shared render-time ID function unless persistence is required.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
