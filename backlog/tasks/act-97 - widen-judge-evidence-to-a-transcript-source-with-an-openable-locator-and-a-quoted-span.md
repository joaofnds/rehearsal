---
id: ACT-97
title: >-
  widen judge evidence to a transcript source with an openable locator and a
  quoted span
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
updated_date: '2026-09-09 13:01'
labels: []
dependencies:
  - ACT-49
priority: low
ordinal: 93008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's judge pane cites evidence with a source chip (transcript / diff / instruction), a locator that opens the file (session.jsonl:1284, src/auth/tokens.ts +38 -12, skills/implement.md:43), and a blockquote of the cited span. The harness's evidenceSchema (contracts.ts:32) has source: diff | baseline-context | local-checks, a path, and a claim string. There is no transcript source kind, no line-number locator, and no stored quoted span distinct from the claim text. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A judge finding can cite a transcript line range as its source, distinct from diff and local-checks
- [ ] #2 A citation carries a locator a UI can open directly (file path plus line or line range) rather than only a path
- [ ] #3 The cited span's original text is retrievable from the record, not only the judge's paraphrase of it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set Low this run, from unprioritized.

Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.
<!-- SECTION:NOTES:END -->
