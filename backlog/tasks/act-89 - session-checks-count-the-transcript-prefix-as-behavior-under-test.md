---
id: ACT-89
title: session checks count the transcript prefix as behavior under test
status: To Do
assignee: []
created_date: '2026-09-06 12:44'
updated_date: '2026-09-06 12:44'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 85008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool-calls check counts only tool uses from the turn under test, not those in a seeded transcript prefix (observed: brief-reply-92b2e8b0 scored 211 tool calls on a one-turn reply that made none)
- [ ] #2 A case with a transcript prefix and no tools passes a max-0 tool-calls check when its reply uses no tools (observed 2026-09-06 run 935649b6)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found 2026-09-06 while regenerating the ACT-73 baseline (João's direction: 'agree, regen').

The run: 'rehearsal run --case brief-reply-92b2e8b0 --model sonnet', record at .benchmark-runs/sessions/brief-reply-92b2e8b0/935649b6-55b2-42b3-b3ce-9e52eba38b03/attempt.json. word-band and forbidden-text PASS; tool-calls FAIL at '211 tool calls, more than 0'.

The turn made none. The record's own metrics say turns 1, outputTokens 199, durationMs 8280, and the reply is plain prose. 211 tool calls in 8 seconds against 199 output tokens is not possible.

Mechanism, read directly rather than inferred: session-attempt.ts:334 passes toolUses(transcript) to evaluateChecks, where transcript is the whole written transcript file. For a case with a transcript prefix that file is the seeded history plus the turn. This case seeds 1268 messages from session 92b2e8b0. So the count is the fixture's history.

The check itself (session-check-tool-calls.ts) is correct; it counts what it is handed. The defect is the caller's, and it is not confined to tool-calls: session-check.ts:55 hands the same list to evaluateFilesRead, so files-read is measuring the prefix too.

Cost: every session case that declares a transcript prefix and any tool-use check is scoring the fixture instead of the model. Such a case cannot pass, and its failures carry no information about the corpus edit under test. This is the same class of harm ACT-73 names for stale: a signal that fires regardless of the behavior it claims to measure.
<!-- SECTION:NOTES:END -->
