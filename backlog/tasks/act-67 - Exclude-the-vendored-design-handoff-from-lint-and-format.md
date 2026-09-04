---
id: ACT-67
title: Exclude the vendored design handoff from lint and format
status: To Do
assignee: []
created_date: '2026-09-04 20:57'
updated_date: '2026-09-04 20:57'
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
- [ ] #1 bun run lint exits 0 on a clean tree
- [ ] #2 bun run fmt:check exits 0 on a clean tree
- [ ] #3 bun run fmt leaves docs/design-handoff/ unchanged
<!-- AC:END -->
