---
id: ACT-32
title: >-
  evaluate transcript checks over the records an attempt appended, not the
  resumed prefix
status: Done
assignee: []
created_date: '2026-09-03 04:21'
updated_date: '2026-09-07 16:24'
labels:
  - defect
milestone: m-3
dependencies: []
priority: medium
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
- [x] #1 A session attempt that resumes a transcript prefix and makes no tool call of its own passes tool-calls max 0, proven by a test over a fixture transcript whose prefix carries tool_use records and whose appended records carry none
- [x] #2 files-read is evaluated over the same appended records, so a file the resumed prefix read does not count as one the attempt read
- [x] #3 A session case with no transcript prefix evaluates both checks exactly as it does today, proven by the smoke case's existing assertions still passing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: premise re-checked. src/benchmark/session-attempt.ts passes `toolUses(transcript)` over the whole forked transcript at line 318; the card cites line 284, which moved with ACT-25's later commits. One site, unchanged in substance.

Per decision-1, a line number is not a measurement: the site is the `toolUses(transcript)` call in `recordAttempt`'s request assembly in src/benchmark/session-attempt.ts, one call, found by `grep -n 'toolUses' src/benchmark/session-attempt.ts`.

Triage 2026-09-04: premise re-verified at 45c522c and unchanged. `grep -n 'toolUses' src/benchmark/session-attempt.ts` returns one evaluation site, in `recordAttempt`, passing the whole parsed transcript into `evaluateChecks`. Nothing in that function reads the case's `cut`, so the fix has to carry the cut into `recordAttempt`, which today receives only the request, the attempt directory, and the attempt output.

Acceptance #2's premise also confirmed: `files-read` is a real check kind (src/benchmark/session-check-files-read.ts) evaluated from the same evidence record, so both kinds are fixed by the same change rather than needing two.

Triage 2026-09-04, re-prioritized against the goal: high → medium, assigned to m-3. It is a genuine correctness defect and it stays ahead of the refactoring cards. It ranks below m-1 because it makes session-case evidence trustworthy, and session cases measure the reply-shaping corpus (the brief output style), not the workflow corpus the tool exists to tune. Nothing in m-1 or m-2 depends on it.

Triage 2026-09-07 (second pass, 16:20): overtaken. Commit 2229463 ('fix: slice the transcript at the prefix cut before scoring tool-use checks', 2026-09-06) already does exactly what this card asks: session-attempt.ts:334-335 evaluates toolUses(transcript.slice(cut)), and files-read consumes the same sliced toolUses via CheckEvidence, so AC #1 and #2 are satisfied by one change. A test at session-attempt.test.ts:479 (cut: 1) exercises it. AC #3 (no-prefix case) is a no-op slice by construction and the smoke case's existing assertions were not disturbed. Verified this session: fresh full suite 1088+62 pass, 0 fail, typecheck/lint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as Done, overtaken by commit 2229463 (2026-09-06), which fixed the transcript-prefix defect this card described before the card was closed. Verified against a fresh suite run (1088+62 pass) rather than inference.
<!-- SECTION:FINAL_SUMMARY:END -->
