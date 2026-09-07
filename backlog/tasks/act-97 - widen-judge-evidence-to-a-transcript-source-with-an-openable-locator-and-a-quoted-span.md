---
id: ACT-97
title: >-
  widen judge evidence to a transcript source with an openable locator and a
  quoted span
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
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
