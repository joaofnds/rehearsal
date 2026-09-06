---
id: ACT-89
title: session checks count the transcript prefix as behavior under test
status: Done
assignee: []
created_date: '2026-09-06 12:44'
updated_date: '2026-09-06 13:02'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 85008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A tool-calls check counts only tool uses from the turn under test, not those in a seeded transcript prefix (observed: brief-reply-92b2e8b0 scored 211 tool calls on a one-turn reply that made none)
- [x] #2 A case with a transcript prefix and no tools passes a max-0 tool-calls check when its reply uses no tools (observed 2026-09-06 run 935649b6)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed in 2229463 and 676ad9a. Root cause: recordAttempt in
session-attempt.ts built toolUses from the whole parsed transcript
(prefix included) and handed it to evaluateChecks, so tool-calls and
files-read both scored the seeded prefix instead of the turn under
test. Fix: slice the parsed transcript at declaration.transcript.cut
(default 0 for no-prefix cases, a no-op slice) before computing
toolUses. One call site fixes both checks, since both read the same
evidence.toolUses.

Verified directly against the real record cited in this card
(brief-reply-92b2e8b0, run 935649b6): toolUses over the whole
transcript is 211, over transcript.slice(1268) is 0, matching the
card's own numbers, and the tool-calls check now PASSes on that real
run's reply.

Review: six axes dispatched (spec, style, architecture, security,
testing, refactoring), all via review-code. Style, architecture,
security, refactoring: clean, nothing found. Spec: found two AC-adjacent
gaps with no test movement, both closed in 676ad9a - files-read scored
through a prefix case, and the no-prefix path through a real (non
NO_REPLY) check evaluation. Testing: found one note-severity dead-code
site in the first test (a declaration.checks override the harness never
reads, and resumingCase called twice inline); closed in 676ad9a by
adding an overrides parameter to resumingCase so every prefix-case test
now builds the case once.

Verified: mise exec -- bun test (1057 pass, 0 fail), bun run lint, bun
run typecheck, bun run fmt:check all clean.

Not verified: no live model run against a real session case exercising
this path end to end (would cost a real Claude call); verification
instead replayed the exact real transcript/case data the card's own
investigation captured, through the actual parseTranscriptFile /
toolUses / evaluateChecks code path.

Independently verified after the build session, 2026-09-06: re-ran 'rehearsal run --case brief-reply-92b2e8b0 --model sonnet' (record 936e9ee1). All three checks PASS, tool-calls reading '0 tool calls' where the pre-fix run 935649b6 read '211 tool calls, more than 0'. Full suite 1057 pass / 0 fail, up from the 1054 baseline before the fix.
<!-- SECTION:NOTES:END -->
