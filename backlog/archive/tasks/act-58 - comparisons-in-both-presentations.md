---
id: ACT-58
title: 'comparisons, in both presentations'
status: To Do
assignee: []
created_date: '2026-09-04 13:07'
updated_date: '2026-09-04 13:07'
labels: []
dependencies:
  - ACT-50
priority: medium
ordinal: 60008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SPEC.md section 5. Attempt pairs and what-moved, switchable. The baseline arm is mandatory: it strips the skill under test and keeps everything else, which is what proves the corpus does any work at all.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both presentations render from real comparison records and are switchable
- [ ] #2 The baseline arm is always present, and a comparison that lacks one is refused rather than rendered
- [ ] #3 Word counts appear beside cost, so verbosity is visible next to any claimed improvement
- [ ] #4 An attribution claim is made only when exactly one instruction file hash differs between arms, and is refused in words when more than one does
- [ ] #5 Stale records are excluded from comparisons and the exclusion is visible
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
