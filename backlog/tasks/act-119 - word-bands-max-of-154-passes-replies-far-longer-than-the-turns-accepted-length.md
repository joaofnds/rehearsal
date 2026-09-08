---
id: ACT-119
title: >-
  word-band's max of 154 passes replies far longer than the turn's accepted
  length
status: To Do
assignee: []
created_date: '2026-09-08 12:25'
updated_date: '2026-09-08 12:25'
labels: []
dependencies: []
ordinal: 115008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
All four brief-reply session cases declare `word-band { max: 154 }`, but the
lengths Joao actually accepted for those turns are 145, 136, 108, and 76. The
check therefore passes a reply up to roughly twice the length the turn really
took.

Observed 2026-09-08 in ACT-35's runs, one debug rep per case, --model sonnet:

  case                  accepted  reply  word-band
  brief-reply-e3dea673       145    158  FAIL
  brief-reply-02f0f204       136    286  FAIL
  brief-reply-40878d26       108    129  PASS
  brief-reply-92b2e8b0        76    164  FAIL

Only 40878d26 passes, and even it ran 129 words against an accepted 108. The
three FAILs are honest signal. The concern is the PASS band: 92b2e8b0's accepted
length is 76, so a 154-word reply would score PASS at more than double the
target. A single shared max across four turns of different accepted lengths
cannot express "as brief as this turn actually was".

This is a question about what the check should measure, not a data edit, which is
why ACT-35 recorded it rather than changing the declarations. Options worth
weighing: a per-case max derived from that turn's accepted length, a band with
both a floor and a ceiling, or a tolerance expressed relative to the accepted
length rather than as an absolute.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each brief-reply case's word-band expresses that turn's accepted length rather than a shared absolute max
- [ ] #2 Re-running the four brief-reply cases scores each reply against its own turn's accepted length
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed from ACT-35's runs, 2026-09-08. Referenced by ACT-35's completion notes.
<!-- SECTION:NOTES:END -->
