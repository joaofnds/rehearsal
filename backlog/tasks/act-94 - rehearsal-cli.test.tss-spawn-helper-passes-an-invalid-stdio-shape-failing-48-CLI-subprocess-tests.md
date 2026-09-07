---
id: ACT-94
title: 'the client test preload breaks the CLI''s subprocess tests, failing 48'
status: To Do
assignee: []
created_date: '2026-09-07 14:03'
updated_date: '2026-09-07 14:41'
labels: []
dependencies: []
type: bug
ordinal: 90008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun test from the repository root passes every test in src, tools, and client in one command (measured: 1102 pass / 48 fail on 2026-09-07 with the preload global)
- [ ] #2 the CLI's subprocess tests pass with the client's DOM setup present, since Bun.spawn's stdio contract was never the cause (probe: emptying bunfig.toml turns 47 failures into 47 passes)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found while building ACT-52 (design system). Confirmed pre-existing: same 48 failures reproduce on main with git stash applied, before any client/ file existed. Error: 'TypeError: stdio must be an array of inherit, ignore, or null / code: ERR_INVALID_ARG_TYPE' at src/cli/rehearsal-cli.test.ts:46 in runCli, which calls Bun.spawn([...], { stdio: [...] }). Every failing test goes through runCli. Not investigated further, out of ACT-52's path.

Correction 2026-09-07: the original title/AC named only rehearsal-cli.test.ts. A fresh full-suite run plus grep on the failure output (mise exec -- bun test, then grep -B3 'stdio must be an array' and grep -c '^(fail)') shows 48 total (fail) lines: 47 through runCli in src/cli/rehearsal-cli.test.ts:46, and 1 through the same-shaped Bun.spawn call in src/benchmark/benchmark-command.test.ts:86, both raising the identical 'TypeError: stdio must be an array of inherit, ignore, or null'. Both still pre-existing and out of ACT-52's path; this only fixes which files a fresh session needs to open.

Cause confirmed 2026-09-07 by probe, and it is not the stdio shape the card's title names. The root bunfig.toml added by ACT-52 preloads client/test-setup.ts into every test process in the repository. That file calls GlobalRegistrator.register(), which installs happy-dom's globals and breaks Bun.spawn for the CLI's subprocess tests. Probe: emptying bunfig.toml takes src/cli/rehearsal-cli.test.ts from 47 fail to 47 pass, with no other change. runCli's Bun.spawn call is valid and untouched by ACT-52.

Three fixes tried and reverted, each measured on the full suite: registering happy-dom only when Bun.argv mentions client/ (57 fail, worse, because a combined run does not name files in argv); moving the preload to client/bunfig.toml (57 fail, the root run stops reading it and client tests lose the DOM); splitting the script into 'bun test src tools && bun test --cwd client' (57 fail, the path filter did not scope the run and all 76 files were still collected).

So the two suites need different globals in one process and Bun's single preload cannot give them that. The next thing to try is running them as two separate bun test invocations that actually scope their file sets, which means establishing how Bun scopes a run before writing the script rather than assuming a path argument does it. Failing that, the DOM registration moves into the client tests themselves rather than a preload.
<!-- SECTION:NOTES:END -->
