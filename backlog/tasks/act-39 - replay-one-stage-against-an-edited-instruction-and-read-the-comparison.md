---
id: ACT-39
title: replay one stage against an edited instruction and read the comparison
status: To Do
assignee: []
created_date: '2026-09-04 01:50'
labels: []
milestone: m-1
dependencies:
  - ACT-38
priority: high
ordinal: 41008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The loop the tool exists for, run once: take a checkpoint ACT-38 recorded, change one instruction in the corpus, replay that one stage against the changed corpus, and read the comparison between the two attempts.

This is the inner loop from docs/vision.md and the reason the project exists. Every piece is built (replay, lineage, staleness, comparison reporting) and none has carried a real corpus edit.

Pick an edit whose effect is arguable rather than obvious, so the comparison has to do work. What matters is whether the operator can answer 'did that edit help' from what the tool prints, without reading the raw transcripts.

Depends on ACT-38: there is no checkpoint to replay until a run has recorded one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One stage is replayed from an ACT-38 checkpoint against a corpus with exactly one instruction file changed
- [ ] #2 `rehearsal stale` reports the checkpoints that edit invalidated, before the replay runs
- [ ] #3 `rehearsal compare` produces a report over the two attempts, and its path is recorded on this card
- [ ] #4 The question 'did that edit improve the stage' is answered on this card from the comparison's own output, with the sentence that answered it quoted, or recorded as unanswerable with what was missing
<!-- AC:END -->
