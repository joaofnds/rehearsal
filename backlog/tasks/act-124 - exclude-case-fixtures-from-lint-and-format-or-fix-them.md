---
id: ACT-124
title: 'exclude case fixtures from lint and format, or fix them'
status: To Do
assignee: []
created_date: '2026-09-08 21:42'
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
- [ ] #1 bun run lint exits zero on a clean checkout
- [ ] #2 bun run fmt:check exits zero on a clean checkout
- [ ] #3 A case fixture's bytes are unchanged by whichever route is taken, shown by the corpus digests the harness records
<!-- AC:END -->
