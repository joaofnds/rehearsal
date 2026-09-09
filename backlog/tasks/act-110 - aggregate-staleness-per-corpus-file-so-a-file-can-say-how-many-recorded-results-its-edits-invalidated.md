---
id: ACT-110
title: >-
  aggregate staleness per corpus file, so a file can say how many recorded
  results its edits invalidated
status: To Do
assignee: []
created_date: '2026-09-07 23:09'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: low
type: feature
ordinal: 106008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Derive a per-corpus-file count of invalidated recorded results from structured staleness evidence and a defined edit identity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Given a corpus file that changed since a checkpoint was recorded, a report says how many recorded results that file invalidated, derived from structured data rather than by parsing the English cause sentences (verified 2026-09-07 that StaleRecord in src/benchmark/staleness-report.ts carries causes as free-text strings built through CASE_STALENESS_WORDING, and that a cause can also be a raw CorpusFileError message, so three wordings and two error shapes would have to be parsed)
- [ ] #2 The report keys the count by corpus file path, the reverse of today's record-to-causes direction, so the corpus screen can render a per-file invalidated count
- [ ] #3 What 'the last edit' means for SPEC.md section 6's header card is settled and written on this card, since nothing on disk defines it today
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. Per-file impact is valuable for the corpus screen, but the current free-text record and undefined last-edit concept cannot support a correct build.

Evidence: StaleRecord maps records to free-text causes; no structured reverse file-to-invalidated-results aggregate exists.

Unresolved claims/resources: Structured cause schema and last-edit semantics are unset.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Define structured stale causes and what last edit means, then derive reverse counts.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
