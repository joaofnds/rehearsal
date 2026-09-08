---
id: ACT-130
title: >-
  One symlink in the corpus blanks the whole run-history screen instead of
  degrading
status: To Do
assignee: []
created_date: '2026-09-08 22:41'
updated_date: '2026-09-08 23:16'
labels: []
milestone: m-5
dependencies: []
priority: high
ordinal: 126008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 with a symlink planted in a corpus layout directory, GET /api/runs renders its rows and reports the corpus problem alongside them, rather than returning 500 with no rows (reproduced 2026-09-09: corpusReport on a directory corpus with agents/escape -> outside threw SymlinkedEntryError, and staleCheckpoints reaches the same walk)
- [ ] #2 the same corpus problem leaves rehearsal stale reporting what it could read rather than exiting on the first unreadable tree (src/cli/stale-command.ts:81 calls staleCheckpoints on the same path)
- [ ] #3 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the security and architecture reviewers on ACT-113 (commit 438145a), independently, both with a reproduction.

src/server/run-history.ts:202 awaits staleCheckpoints OUTSIDE the try block that starts
at :213. That function's own docstring at :188-196 states the intent this violates: 'a
corpus file staleCheckpoints cannot resolve, is collected rather than thrown ... so a
single bad run cannot blank the whole response the way an uncaught throw would.'

The path is staleCheckpoints -> currentStageCorpus -> captureStageCorpus -> hashDirectory.
Before ACT-113 that walk followed a planted symlink and rendered (leaking); now it throws,
and api.ts's onError turns the throw into a 500 for the whole screen. So ACT-113 traded a
leak for an outage on this surface. The leak was the worse of the two and closing it was
right, but the degraded mode this file already promises was never wired to this call.

ACT-113's shaping accepted the 500 for /api/corpus explicitly and considered no other
surface. This one and  were not considered.

Not folded into ACT-113: deciding what the screen shows when the corpus cannot be hashed
is a product question the card did not shape, and it changes what the endpoint delivers.

The gap is pre-existing in structure (the call has always sat outside the try). What
changed is that a reachable input now throws through it.

Correction to the line above: the sentence should read "This one and the stale command were not considered." A backtick swallowed the phrase when the note was written.

Triage 2026-09-09, premise check on AC#2. The criterion cites src/cli/stale-command.ts:81 as calling staleCheckpoints unguarded. Read this run: line 80 already wraps that call in refusingCorpusFailures. The wrapper (stale-command.ts:35-50) catches only CorpusSourceError and CorpusFileError and rethrows everything else, and SymlinkedEntryError (checkpoint.ts:84) extends Error directly, so it is not caught. The criterion's behavior stands; its stated cause does not. The writer's evidence stays as written above.

The reproducing command, per decision-1: plant a symlink in a corpus layout directory, then run mise exec -- ./rehearsal.ts stale --corpus <that root>.
<!-- SECTION:NOTES:END -->
