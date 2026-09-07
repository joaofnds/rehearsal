---
id: ACT-94
title: 'The CLI subprocess spawn helpers pass an invalid stdio shape, failing 48 tests'
status: To Do
assignee: []
created_date: '2026-09-07 14:03'
updated_date: '2026-09-07 14:27'
labels: []
dependencies: []
type: bug
ordinal: 90008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun test on main, no client/ changes, passes 1103/1103 rather than 1055/1103 with 48 failures
- [ ] #2 runCli in src/cli/rehearsal-cli.test.ts:46 calls Bun.spawn with an stdio value Bun 1.4.0 accepts, or the helper is fixed to match Bun.spawn's actual stdio contract
- [ ] #3 bun test on main, no client/ changes, passes 1103/1103 rather than 1055/1103 with 48 failures
- [ ] #4 runCli in src/cli/rehearsal-cli.test.ts:46 (47 of the 48 failures) and the equivalent Bun.spawn call in src/benchmark/benchmark-command.test.ts:86 (the remaining 1) call Bun.spawn with an stdio value Bun 1.4.0 rejects, or each helper is fixed to match Bun.spawn's actual stdio contract
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found while building ACT-52 (design system). Confirmed pre-existing: same 48 failures reproduce on main with git stash applied, before any client/ file existed. Error: 'TypeError: stdio must be an array of inherit, ignore, or null / code: ERR_INVALID_ARG_TYPE' at src/cli/rehearsal-cli.test.ts:46 in runCli, which calls Bun.spawn([...], { stdio: [...] }). Every failing test goes through runCli. Not investigated further, out of ACT-52's path.

Correction 2026-09-07: the original title/AC named only rehearsal-cli.test.ts. A fresh full-suite run plus grep on the failure output (mise exec -- bun test, then grep -B3 'stdio must be an array' and grep -c '^(fail)') shows 48 total (fail) lines: 47 through runCli in src/cli/rehearsal-cli.test.ts:46, and 1 through the same-shaped Bun.spawn call in src/benchmark/benchmark-command.test.ts:86, both raising the identical 'TypeError: stdio must be an array of inherit, ignore, or null'. Both still pre-existing and out of ACT-52's path; this only fixes which files a fresh session needs to open.
<!-- SECTION:NOTES:END -->
