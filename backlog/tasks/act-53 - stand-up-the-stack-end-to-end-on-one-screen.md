---
id: ACT-53
title: stand up the stack end to end on one screen
status: Review
assignee:
  - '@claude'
created_date: '2026-09-04 14:20'
updated_date: '2026-09-07 21:45'
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
- [x] #1 Running `bun rehearsal.ts list runs` against the checked-in .benchmark-runs shows run:2026-09-06T21-58-29.508Z as STOPPED:build; the same row renders in the browser as a stopped outcome using the Status component (not hand-rolled markup), and the row's corpus cell shows a corpus digest computed from that run's own corpusFiles (proven by a test that changes one byte of a fixture corpus file and asserts the rendered digest changes)
- [x] #2 The stale checkpoint checkpoint:2026-09-06T21-58-29.508Z/shape renders with a stale badge computed by the server calling staleCheckpoints (src/benchmark/staleness-report.ts) on every request, not from a cached or startup-computed value -- proven by a test that edits a corpus file between two requests to the same route and asserts the second response's staleness differs from the first
- [x] #3 Pointing the server at an empty temp directory (no records) renders the empty-state block from SPEC.md section 1, not a blank table or a client error
- [x] #4 A request for a record id containing a path segment that escapes the runs directory (e.g. a checkpoint stage of ../../etc/passwd) gets a non-500 refusal from the route, proven by a test that calls the route handler directly, not by manual inspection
- [x] #5 No absolute filesystem path reaches the browser from any route failure: a malformed JSON fixture renders its row with the reason string list-command.ts's controlRelative already produces (existing path), and a test separately drives an error from the route's own new code (e.g. recordFileFor thrown against a missing file) and asserts that response body also carries no absolute path (new path, since controlRelative only wraps listRecords's own try/catch and nothing sanitizes a route-level throw today)
- [x] #6 The read API's JSON response shape for a run-history row is written down in this card or in code as the single place that owns it (per the card's prior Direction note, question 1: 'no other card owns it'), naming its fields in decision-5's code vocabulary (stage, pipeline, run), never the design's task/step labels
- [x] #7 Run history's table, status cells, grade column, corpus cells, and filter bar are built from five of ACT-52's six named components (Status, Grade, CorpusPill, FilterPill, TableShell) by import, not by new markup that happens to look similar -- proven by grepping the new screen's source for each component name. SectionLabel is not imported: its only use duplicated TableShell's own caption, rendering the same text twice (fixed in commit 19024c2), so this screen has no second place to put it.
- [x] #8 mise exec -- bun run typecheck, lint, fmt:check, and test all exit 0 with client/ and the new server code in the tree; a test CSS file with a bare hex color or bare px spacing value in the new server-facing client code fails bun run lint:css (reusing ACT-52's stylelint config, not a new one)
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
Adversarial code review (6 reviewer agents, one per axis: spec, style, architecture, security, testing, refactoring), 2026-09-07, on this session's implementation commits (b784409..753b795).

Suite run before review: `mise exec -- bun run test` — 1141 pass, 0 fail (server) + 76 pass, 0 fail (client). typecheck/lint/fmt:check/lint:css all exit 0.

**Blocking, fixed and verified (commit 542a8c4):**
- [correctness, security] `runHistoryRows` threw straight out of its per-run loop instead of collecting a failing run (list-command.ts's `collect()` precedent), so one malformed run.json or one missing-skill-directory throw from `staleCheckpoints` took the whole `/api/runs` response down with a 500. `controlRelative` only strips `CONTROL_DIR`, so a path from the corpus root or the target repository (neither ever under `CONTROL_DIR`) reached the browser verbatim. Reproduced live before the fix: a run missing its build skill returned `searched /var/folders/.../probe-corpus` in the response body. Independently found by spec, architecture, and security axes. Fixed: `runHistoryRows` → `runHistoryReport`, returning `{ rows, unreadable }`; every route-level sanitization point now uses `redact-path.ts`'s `redactAbsolutePaths` (redacts any absolute path, anchored so it doesn't eat a relative record id or corpus path).
- [testing] Two of three "no absolute path" assertions in api.test.ts were vacuous: fixtures never place data under `CONTROL_DIR`, so `.not.toContain(CONTROL_DIR)` couldn't see the real leak and passed even with sanitization removed (confirmed by removing it and re-running). Fixed: replaced with a pattern assertion; added a fourth test reproducing the `staleCheckpoints` throw directly.

**Should-fix, fixed and verified:**
- [testing, commit 542a8c4] `router.test.tsx` restored `globalThis.fetch` only at the end of each test body; a failing assertion skipped it and leaked the stub into later tests (confirmed by forcing a failure). Moved to `afterEach`.
- [testing, commit 542a8c4] No test for the "Stopped" filter's actual narrowing behavior. Added; confirmed it kills the mutant `matchesFilter -> return true`.
- [spec + architecture, commit ac11a96] Client hand-declared the wire schema (`run-history-row.ts`'s zod schema) instead of using Hono's RPC client, which decision-3 names as the specific reason for choosing Hono ("its RPC client shares types with the server rather than having the record shapes redefined by hand in the client"). Fixed: api.ts's routes are one unbroken chain from `new Hono()` exporting `ApiRoutes`; client fetches via `hc<ApiRoutes>()` in `client/src/api-client.ts`; `RunHistoryRow` is now `InferResponseType`-derived, not a second declaration. `run-history-row.ts` deleted.
- [architecture + refactoring, commit 753b795] A stopped run with no manifest was silently dropped from `/api/runs` (both `rows` and `unreadable`), where `list runs` reports it unreadable by id and reason (existing `writeStoppedRunWithoutManifest` coverage there). Fixed: `statusAndCaseId` now throws the matching message in that case, collected by the existing per-run try/catch.

**Notes, no action (advisory or pre-existing, revert-test does not implicate this change):**
- [refactoring] `run-history.ts`'s `statusAndCaseId` still duplicates `list-command.ts`'s `listRuns` closure structurally (same three-step recipe), though the behavioral divergence that made it a defect is now fixed. Extracting a shared function is a genuine cross-cutting change (touches the CLI too) — tracked as a follow-up, not done in this session.
- [architecture] Two full directory passes per `/api/runs` request (`staleCheckpoints` + the row loop) — pre-existing, deliberate per this card's own AC #2 (live per-request staleness).
- [style] `columns={[...COLUMNS]}` allocates unnecessarily (`COLUMNS` directly satisfies `TableShell`'s prop). Cosmetic.
- [style] Empty-state's "Declare a case" button is a bare `<button>`; no Button component exists yet in the design system to compose from instead, and AC #7 doesn't name it.
- [security] `record-id.ts`'s traversal guard checks `.`, `..`, `/` but not `\` — POSIX-only concern (this repo's dev/CI platform), not exploitable here.
- [security] `Bun.serve` binds with no explicit hostname — unverified belief, out of this card's stated scope (id-traversal, path-leak).

Oversight probes, 2026-09-07 (iteration session, after the build):

Verified directly, not taken from the build session's report:
- Full suite green from a fresh run: 1142 server, 78 client. typecheck, lint, fmt:check, lint:css all exit 0.
- The path-redaction fix is really pinned. Reverting redactAbsolutePaths to 'return message' fails six tests, four of them at the route level, including the staleCheckpoints-throws case. Restored after the probe.
- The live server serves the stopped run with stale:true and the corpus digest, matching what the CLI's 'list runs' and 'stale' report. A traversal id returns 400, not 500.
- The rendered page was checked in a browser, which the build session could not do. Run history renders the stopped run, the stale badge, corpus@a3a62f, and the Stopped filter narrows correctly. The empty state renders against a records directory with no records.

One defect the DOM tests could not see, found only in the browser and fixed in its own commit: TableShell renders its own caption, and the page also rendered a SectionLabel with the same text, so 'DURABLE RECORDS' appeared twice. No test queried that text before this fix, so none could have caught it (corrected here: this note previously said getByText passed on either copy; @testing-library/dom 10.4.1, the version installed, throws on multiple matches instead, per commit 19024c2's own review below). The caption was kept as the table's accessible name. A test now asserts one occurrence and the table's accessible name.

Left for ACT-107: the empty-state sentence carries an em dash, copied faithfully from SPEC.md section 1, which AC #3 requires the empty state to match. Rewording is a change to what the card builds, so it is a card rather than a fix folded in here.

Two stray files appeared at the repository root during the stage sessions, referenced by nothing in the tree: claude-hook-api-report.md (317 lines of hook API probes) and wp-fs.md (2 bytes). Neither is a product of this card. Both moved to /tmp/rehearsal-stash/ rather than deleted.

Adversarial code review (6 reviewer agents, one per axis: spec, style, architecture, security, testing, refactoring), 2026-09-07, on commit 19024c2 alone (the duplicate-caption fix found by the oversight pass above), the one commit not covered by the six-axis pass on b784409..753b795 or by the oversight probes themselves.

Suite run before review: `mise exec -- bun run test` — 1142 pass, 0 fail (server) + 78 pass, 0 fail (client). No blocking or should-fix findings against the commit's own diff; the fix is minimal and correctly scoped, and the new test is a real regression guard (verified: reverting the fix would make `getAllByText("DURABLE RECORDS")` return 2, and `@testing-library/dom` 10.4.1's `getByRole`/`toHaveAccessibleName` pin is genuine, not a re-derivation of the subject).

**Should-fix, disposed on this card's record:**
- [spec] AC #7 still named SectionLabel as one of the six required components and was still checked, though this commit removes SectionLabel's only use from the screen. Fixed: AC #7 reworded above to five components, with the reason (SectionLabel's only use duplicated TableShell's own caption).
- [testing] This card's own oversight note (above) claimed the bug went undetected because "getByText passes on either copy". Verified false: `@testing-library/dom` 10.4.1 (the version installed) throws `getMultipleElementsFoundError` on multiple matches, and `git show 19024c2^:.../run-history-page.test.tsx` shows no prior test queried "DURABLE RECORDS" at all. The real reason is simpler: nothing looked at that text before. Corrected in place above.

**Note, tracked as a follow-up, not fixed here (pre-existing, not created by this commit):**
- [refactoring] The same double-caption defect this commit fixes is still live at client/src/system/system-page.tsx:201-203 (SectionLabel>TABLE SHELL immediately followed by TableShell caption="DURABLE RECORDS", the design-system gallery page itself). Confirmed by reading table-shell.tsx's `<caption>` rendering against system-page.tsx directly. Revert test: this bug predates 19024c2 and isn't touched by it, so it's this card's tracked note rather than this commit's blocker.

Iteration stopped here, 2026-09-07. Review is clean across every commit on this card and recommends Done. The board guard blocks that move: AC #9 is unchecked, and the card carries no 'partial' or 'abandoned' label. AC #9 is unfalsifiable on this card by its own wording, since it defers confirmation to whichever card builds the second screen (ACT-50 or ACT-51). Closing it needs a direction: either label this card 'partial' with AC #9 named as the deferred item, or move AC #9 onto ACT-50/ACT-51 as their criterion and close this card whole. Not decided in this session.
<!-- SECTION:NOTES:END -->
