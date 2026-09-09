---
id: ACT-142
title: >-
  GET /api/runs returns a 500 for the corpus state /api/corpus now reports as a
  refusal
status: Shape
assignee: []
created_date: '2026-09-09 15:46'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: medium
type: bug
ordinal: 138008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep run history usable when current corpus instructions are refused, naming the corpus entry instead of returning a route error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With recorded runs present, GET /api/runs returns 200 and names refused CLAUDE.md evidence when a directory-source instruction link escapes or a live instruction link loops, while preserving readable history (ACT-142 original directory-source reproduction; doc-61 live-root-loop reproduction with recorded runs)
- [ ] #2 the run-history screen against that corpus state does not render 'Could not load run history.' (client/src/run-history/run-history-page.tsx pins that text to the query error, read 2026-09-09)
- [ ] #3 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by ACT-137's code review, 2026-09-09, and confirmed at the source by that session: readCorpusInstructions on a directory source whose CLAUDE.md symlinks outside the root throws SymlinkedEntryError. src/benchmark/staleness-report.ts:181 calls it outside any try, and src/server/api.ts wraps the /api/runs route in no try/catch, so the throw reaches app.onError as a 500. hashCorpusFiles at staleness-report.ts:306 is the second unwrapped call site; caseStaleness at :300 already wraps its own.

The ACT-137 session verified the throw directly and filed this without reproducing the HTTP 500 itself; the review reproduced that, hitting both routes on one app instance.

Why it was not fixed inside ACT-137: the fix lands in staleness-report.ts, which that card never touched, on a different route and a different screen. ACT-137 fixed /api/corpus only.

The shape ACT-137 landed is the precedent: a refusal string in a 200 report, never a throw, because the operator learns which file broke the corpus rather than reading 'Could not load run history.' Whoever takes this should decide whether the run-history report grows a refusals field of its own or reuses the corpus report's, and should check whether the other staleness consumers (the stale CLI command) want the same treatment or want the throw.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. A refused instruction file currently blanks run history, but the response contract and CLI stale behavior must be chosen together.

Evidence: staleCheckpoints calls readCorpusInstructions outside a catch; /api/runs has no route catch; the client renders its load-error message on query failure. Fresh corpus-probes.ts reproduced a LIVE self-looping CLAUDE.md with /api/corpus 200 refusal and /api/runs 500 when recorded runs exist. Empty run history returned 200; the record fixture is required.

Unresolved claims/resources: Structured run-history refusal placement and CLI behavior are unset.

Next action: Choose a named structured refusal for /api/runs, decide whether stale CLI still throws, then add API and client acceptance tests.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
