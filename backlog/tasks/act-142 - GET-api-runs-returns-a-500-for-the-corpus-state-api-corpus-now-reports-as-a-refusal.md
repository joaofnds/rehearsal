---
id: ACT-142
title: >-
  GET /api/runs returns a 500 for the corpus state /api/corpus now reports as a
  refusal
status: To Do
assignee: []
created_date: '2026-09-09 15:46'
updated_date: '2026-09-09 15:47'
labels: []
dependencies: []
type: bug
ordinal: 138008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 with a corpus root whose CLAUDE.md is a symlink resolving outside it, GET /api/runs returns 200 and names the unreadable corpus file, rather than a 500 (reproduced 2026-09-09 by the ACT-137 review: /api/corpus returned 200 with a refusal while /api/runs returned 500 {"error":"Corpus file CLAUDE.md resolves outside the corpus source..."} on one app instance)
- [ ] #2 the run-history screen against that corpus state does not render 'Could not load run history.' (client/src/run-history/run-history-page.tsx pins that text to the query error, read 2026-09-09)
- [ ] #3 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by ACT-137's code review, 2026-09-09, and confirmed at the source by that session: readCorpusInstructions on a directory source whose CLAUDE.md symlinks outside the root throws SymlinkedEntryError. src/benchmark/staleness-report.ts:181 calls it outside any try, and src/server/api.ts wraps the /api/runs route in no try/catch, so the throw reaches app.onError as a 500. hashCorpusFiles at staleness-report.ts:306 is the second unwrapped call site; caseStaleness at :300 already wraps its own.

The ACT-137 session verified the throw directly and filed this without reproducing the HTTP 500 itself; the review reproduced that, hitting both routes on one app instance.

Why it was not fixed inside ACT-137: the fix lands in staleness-report.ts, which that card never touched, on a different route and a different screen. ACT-137 fixed /api/corpus only.

The shape ACT-137 landed is the precedent: a refusal string in a 200 report, never a throw, because the operator learns which file broke the corpus rather than reading 'Could not load run history.' Whoever takes this should decide whether the run-history report grows a refusals field of its own or reuses the corpus report's, and should check whether the other staleness consumers (the stale CLI command) want the same treatment or want the throw.
<!-- SECTION:NOTES:END -->
