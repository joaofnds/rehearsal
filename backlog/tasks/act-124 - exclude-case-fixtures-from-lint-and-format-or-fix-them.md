---
id: ACT-124
title: 'exclude case fixtures from lint and format, or fix them'
status: Done
assignee: []
created_date: '2026-09-08 21:42'
updated_date: '2026-09-08 23:14'
labels: []
dependencies: []
ordinal: 120008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`bun run lint` reports 38 errors and `bun run fmt:check` reports 17 unformatted files, and every one is under `cases/*/fixture/`. Verified 2026-09-08: the same counts appear with ACT-104's commits stashed, so this predates that card and is not caused by it.

These files are benchmark corpus data, not project source. A fixture under `cases/doctrine-ab-without/fixture/` is deliberately written in a style the case is measuring; `order-service.test.ts` trips explicit-member-accessibility, explicit-function-return-type, id-length and no-plusplus, which is plausibly the point of that fixture rather than a defect in it.

The cost is that the project's two checks are red by default, so a session cannot tell its own breakage from the standing noise, and CLAUDE.md tells every session to run them.

Decide which is true and act on it: either fixture trees are not project source and belong in the ignore lists for oxlint and oxfmt, or they are and should be formatted and fixed. The first looks right, since reformatting a fixture changes the bytes a case measures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run lint exits zero on a clean checkout
- [x] #2 bun run fmt:check exits zero on a clean checkout
- [x] #3 A case fixture's bytes are unchanged by whichever route is taken, shown by the corpus digests the harness records
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Overtaken by commit 60d6297 (build: stop linting and formatting case fixture trees), which added cases/*/fixture/** to .oxlintrc.json and .oxfmtrc.json. All three criteria proven this run: mise exec -- bun run lint and bun run fmt:check both exit 0 on a clean checkout (run 2026-09-09, triage), and 60d6297's file list touches only .oxfmtrc.json, .oxlintrc.json and the two case.json declarations, no file under any fixture/ tree, so fixture bytes are unchanged. Closed by triage 2026-09-09.
<!-- SECTION:FINAL_SUMMARY:END -->
