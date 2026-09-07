---
id: ACT-110
title: >-
  aggregate staleness per corpus file, so a file can say how many recorded
  results its edits invalidated
status: To Do
assignee: []
created_date: '2026-09-07 23:09'
labels: []
dependencies: []
type: feature
ordinal: 106008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Given a corpus file that changed since a checkpoint was recorded, a report says how many recorded results that file invalidated, derived from structured data rather than by parsing the English cause sentences (verified 2026-09-07 that StaleRecord in src/benchmark/staleness-report.ts carries causes as free-text strings built through CASE_STALENESS_WORDING, and that a cause can also be a raw CorpusFileError message, so three wordings and two error shapes would have to be parsed)
- [ ] #2 The report keys the count by corpus file path, the reverse of today's record-to-causes direction, so the corpus screen can render a per-file invalidated count
- [ ] #3 What 'the last edit' means for SPEC.md section 6's header card is settled and written on this card, since nothing on disk defines it today
<!-- AC:END -->
