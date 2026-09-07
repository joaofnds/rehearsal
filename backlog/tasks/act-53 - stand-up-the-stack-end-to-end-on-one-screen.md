---
id: ACT-53
title: stand up the stack end to end on one screen
status: To Do
assignee: []
created_date: '2026-09-04 14:20'
updated_date: '2026-09-07 20:51'
labels: []
milestone: m-5
dependencies:
  - ACT-48
  - ACT-52
priority: high
ordinal: 55008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-3 settles the stack. This proves it works end to end before nine screens are built on it, and stops at one screen rather than scaffolding all of them.

Run history is the right screen: it is the landing view, it reads records that already exist on disk, and it needs no event stream. So this card exercises every layer except the one ACT-51 adds.

What it wires:
- Hono on Bun, serving the client bundle and a read API
- the read API going through the CLI read paths (listRecords, recordFileFor, parseRecordId) rather than new record access, so the id-traversal refusal guards the UI too
- React with Vite, TanStack Query and Router
- the design system from ACT-52, with every value coming from it
- Vite as the only added build step, alongside the existing typecheck, lint, fmt, and bun test

Not in scope: SQLite and the event stream (nothing streams until ACT-51), Radix (no dialog on this screen), TanStack Table (add it when sorting and filtering are actually built, not before).

The point is the wiring, not the screen. A second screen should be a matter of adding a route and components, and if it is not, this card has not finished its job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running `bun rehearsal.ts list runs` against the checked-in .benchmark-runs shows run:2026-09-06T21-58-29.508Z as STOPPED:build; the same row renders in the browser as a stopped outcome using the Status component (not hand-rolled markup), and the row's corpus cell shows a corpus digest computed from that run's own corpusFiles (proven by a test that changes one byte of a fixture corpus file and asserts the rendered digest changes)
- [ ] #2 The stale checkpoint checkpoint:2026-09-06T21-58-29.508Z/shape renders with a stale badge computed by the server calling staleCheckpoints (src/benchmark/staleness-report.ts) on every request, not from a cached or startup-computed value -- proven by a test that edits a corpus file between two requests to the same route and asserts the second response's staleness differs from the first
- [ ] #3 Pointing the server at an empty temp directory (no records) renders the empty-state block from SPEC.md section 1, not a blank table or a client error
- [ ] #4 A request for a record id containing a path segment that escapes the runs directory (e.g. a checkpoint stage of ../../etc/passwd) gets a non-500 refusal from the route, proven by a test that calls the route handler directly, not by manual inspection
- [ ] #5 No absolute filesystem path reaches the browser from any route failure: a malformed JSON fixture renders its row with the reason string list-command.ts's controlRelative already produces (existing path), and a test separately drives an error from the route's own new code (e.g. recordFileFor thrown against a missing file) and asserts that response body also carries no absolute path (new path, since controlRelative only wraps listRecords's own try/catch and nothing sanitizes a route-level throw today)
- [ ] #6 The read API's JSON response shape for a run-history row is written down in this card or in code as the single place that owns it (per the card's prior Direction note, question 1: 'no other card owns it'), naming its fields in decision-5's code vocabulary (stage, pipeline, run), never the design's task/step labels
- [ ] #7 Run history's table, status cells, grade column, corpus cells, and filter bar are built from ACT-52's six named components (Status, Grade, CorpusPill, SectionLabel, FilterPill, TableShell) by import, not by new markup that happens to look similar -- proven by grepping the new screen's source for each component name
- [ ] #8 mise exec -- bun run typecheck, lint, fmt:check, and test all exit 0 with client/ and the new server code in the tree; a test CSS file with a bare hex color or bare px spacing value in the new server-facing client code fails bun run lint:css (reusing ACT-52's stylelint config, not a new one)
- [ ] #9 After this card, building a second screen is verified to touch only a new Router route file, its page component, and any new files under client/src/system/components/ -- stated as a prediction here and confirmed or corrected on the card that builds screen two (ACT-50 or ACT-51), rather than asserted as already true of a route that does not exist yet
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adversarial review (reviewer agent), 2026-09-07, on this session's shaping only (the six-AC set and the prior note). Findings and disposition, worst first:

Blocking: none.

Should-fix, folded into the AC set above (old six-AC set replaced outright, now nine):
- The prior Direction note committed to live per-request staleness via staleCheckpoints ("A stale badge that is silently wrong is worse than the cost of hashing the corpus"); this session's first draft dropped that commitment from the ACs entirely, leaving "fed by the server route rather than hardcoded" satisfiable by a cached or startup-computed value. Restored explicitly as AC #2, with a test shape (edit a corpus file between two requests, assert the second response's staleness differs) that only a live-per-request implementation can pass.
- AC #1 (old) asserted rendering but never observed the corpus digest itself, so a wrong or hardcoded digest would still pass. AC #1 (new) requires a test that mutates one corpus file byte and asserts the rendered digest changes, which a hardcoded or wrongly-scoped digest cannot pass.
- The corpus-digest recipe (sha256 over canonicalFiles(corpusFiles)) produces a 64-char hex string; SPEC.md's example (`corpus@a41c7e`) is 6 characters. Neither the recipe note nor any AC named a display length. Left as a build-time choice (truncate to match SPEC.md's example width, full hash available via title/tooltip) rather than a shaping unknown: nothing about the truncation length changes the wiring, the read path, or any acceptance behavior, and getting it wrong costs one line to fix, not a redesign. AC #1 already forces the underlying computation to be correct regardless of display width.
- AC #6 (old, "second screen needs a route and components") tested the card's own prose against itself, which nothing outside the document could fail. Replaced (new AC #9) with a prediction to be confirmed or corrected on the actual second-screen card, which is where it becomes checkable.
- No AC tied Run history's markup to ACT-52's six named components (Status, Grade, CorpusPill, SectionLabel, FilterPill, TableShell) specifically, versus hand-rolled markup that happens to look similar -- exactly the drift ACT-52's own card was built to prevent. Added as new AC #7, checked by grepping the built screen's source for each import.
- The read API response shape (Direction note's answer to question 1: "this card... No other card owns it") had no AC pointing at it. Added as new AC #6.
- AC #4 (old, "no raw filesystem error reaches the browser") only covered the pre-existing listRecords/controlRelative path (unreadable-record reason strings). It did not cover a route-level throw from new server code calling the unexported recordFileFor directly, which controlRelative does not wrap. Widened (new AC #5) to require a second test driving that failure mode directly.
- Decision-5's vocabulary mapping had no per-field AC forcing the new API/route code to use code-side words (stage, pipeline, run) rather than the design's task/step labels. Folded into new AC #6's wording rather than a separate AC, since both are the same read-API-shape surface.

Note, no action: controlRelative strips only the repository root, not the full home directory; this doesn't affect the fix above since runsDirectory is repo-relative in every test and production path here. Glossary "corpus digest" naming re-checked against the reviewer's independent grep of GLOSSARY.md's corpus-adjacent entries: no collision found (reviewer flagged this as not independently re-verified past the corpusFiles/hash search; re-run here: `grep -in "corpus digest" GLOSSARY.md` returns nothing).
<!-- SECTION:NOTES:END -->
