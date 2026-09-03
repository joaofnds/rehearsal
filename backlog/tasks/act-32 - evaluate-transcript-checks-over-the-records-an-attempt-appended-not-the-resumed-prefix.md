---
id: ACT-32
title: >-
  evaluate transcript checks over the records an attempt appended, not the
  resumed prefix
status: To Do
assignee: []
created_date: '2026-09-03 04:21'
updated_date: '2026-09-03 11:58'
labels:
  - defect
dependencies: []
priority: high
ordinal: 34008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-25's first paid attempt of brief-reply-92b2e8b0 failed `tool-calls { max: 0 }` with "211 tool calls, more than 0" while making zero tool calls of its own. Verified in this dispatch: the transcript copy at .benchmark-runs/sessions/brief-reply-92b2e8b0/39c3f302-da90-4480-8e52-aa8f5c4f9638/transcript.jsonl is 1280 lines; `tail -n +1269 | jq '[.message.content[]?|select(.type=="tool_use")]'` returns nothing, and all 211 tool_use records sit inside the 1268-line resumed prefix.

src/benchmark/session-attempt.ts:284 passes `toolUses(transcript)` over the whole forked file. Every transcript-reading check (`tool-calls`, `files-read`) therefore judges the history the case deliberately resumes as if the attempt had done it. Any session case with a transcript prefix fails `tool-calls { max: 0 }` by construction, so the check cannot express "the resumed session replied instead of resuming tool use", which is the failure mode it exists to catch.

The case declares its `cut`, so the attempt already knows where the prefix ends. The likely fix is to evaluate transcript-reading checks over the records after the cut only. That changes what a check kind measures, so it is a design decision rather than a data edit, which is why ACT-25 recorded it instead of making it.

Until this lands, the four brief-reply cases record a FAIL on `tool-calls` that is evidence about the check, not about the corpus.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session attempt that resumes a transcript prefix and makes no tool call of its own passes tool-calls max 0, proven by a test over a fixture transcript whose prefix carries tool_use records and whose appended records carry none
- [ ] #2 files-read is evaluated over the same appended records, so a file the resumed prefix read does not count as one the attempt read
- [ ] #3 A session case with no transcript prefix evaluates both checks exactly as it does today, proven by the smoke case's existing assertions still passing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: premise re-checked. src/benchmark/session-attempt.ts passes `toolUses(transcript)` over the whole forked transcript at line 318; the card cites line 284, which moved with ACT-25's later commits. One site, unchanged in substance.
<!-- SECTION:NOTES:END -->
