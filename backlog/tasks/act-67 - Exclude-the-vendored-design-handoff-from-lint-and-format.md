---
id: ACT-67
title: Exclude the vendored design handoff from lint and format
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 20:57'
updated_date: '2026-09-04 21:03'
labels: []
dependencies: []
type: chore
ordinal: 63008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vendored in bab2b17 and 849bec0, docs/design-handoff/ holds third-party JavaScript that was never added to the lint or format exclusions. On a clean tree at f8e212d, bun run lint reports around 200 type-aware errors in docs/design-handoff/support.js, and bun run fmt:check reports three files. Both guards are therefore red before any change, and bun run fmt rewrites vendored bytes.

Found during ACT-66, whose criterion asked for both to pass; src/ itself is clean under both.

.oxlintrc.json already carries an ignorePatterns list holding .benchmark-runs, tools/oxlint/anti-slop/**, and docs/recovered/**. Adding docs/design-handoff/** there is the shape the repository already uses. oxfmt needs its own exclusion; check whether it reads .oxlintrc.json's ignorePatterns or needs a separate config, by reading the tool's actual interface rather than assuming.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run lint exits 0 on a clean tree
- [x] #2 bun run fmt:check exits 0 on a clean tree
- [x] #3 bun run fmt leaves docs/design-handoff/ unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Build, 2026-09-04

Commit 576cb20. Two lines: docs/design-handoff/** added to ignorePatterns in .oxlintrc.json and .oxfmtrc.json.

### What the card assumed, and what was actually there

The card said to check whether oxfmt reads oxlint's ignorePatterns or needs its own config. It needs its own, and one already existed: .oxfmtrc.json, carrying its own ignorePatterns that already excluded docs/recovered/** exactly as oxlint's does. So both tools had the same shape and the same gap, and the fix is the same line in each. No new mechanism.

Read both configuration schemas before editing: both document ignorePatterns as gitignore-style globs rooted at the config file's directory. oxfmt 0.65.0, oxlint 1.80.0.

### Observed directly

- Criterion 1: `bun run lint` exits 0.
- Criterion 2: `bun run fmt:check` exits 0, 'All matched files use the correct format', 196 files.
- Criterion 3: md5 of support.js, prototype.html and SPEC.md taken before and after `bun run fmt`; identical, and `git status` clean afterward.
- Full check green together: bun test 1002 pass, typecheck, lint, fmt:check all exit 0.

### The guards still bite

An exclusion that silences a guard too broadly is worse than the failing guard. Two probes:

- A file under src/ using `any` with an unsafe member access still fails lint, exit 1, eight findings naming it.
- A deliberately misformatted .js inside docs/design-handoff/ is ignored by fmt:check, exit 0. The exclusion covers the directory rather than only the three files that happened to fail.

Both probe files were removed.

### Why exclude rather than format

docs/design-handoff/ is a delivered artifact, not source. Its own README states support.js must not be ported and must not be imported, and the file's first line says it is generated from another project and not to be edited. Formatting it would rewrite bytes we do not own; linting it reports on code we cannot fix. docs/recovered/** is excluded from both tools for the same reason, so this follows the precedent.

### A third guard, checked and left alone

tsconfig.json excludes docs/recovered but not docs/design-handoff. That is not the same gap: allowJs is off, so tsc never admits support.js to the program, and docs/design-handoff holds no TypeScript. docs/recovered needed its exclude because it carries a src tree. Adding one for design-handoff would guard against a file nobody has put there. Left as is.

### Effect on ACT-66

This closes ACT-66's criterion 12, which was failing only on these two guards. That card's criterion 6 remains unchecked for the separate reason recorded there: it contradicts criteria 5 and 9.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added docs/design-handoff/** to ignorePatterns in .oxlintrc.json and .oxfmtrc.json. Both tools already had that key and both already excluded docs/recovered/** for the same reason, so no new mechanism. Observed: lint and fmt:check each exit 0, and bun run fmt leaves the vendored files byte-identical. Verified the guards still catch real defects in src/ and that the exclusion covers the whole directory, not just the three files that failed. tsconfig.json has no equivalent gap, because allowJs is off and the directory holds no TypeScript.
<!-- SECTION:FINAL_SUMMARY:END -->
