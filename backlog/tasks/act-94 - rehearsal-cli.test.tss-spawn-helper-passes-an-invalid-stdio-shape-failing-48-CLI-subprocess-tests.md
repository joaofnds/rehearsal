---
id: ACT-94
title: 'the client test preload breaks the CLI''s subprocess tests, failing 48'
status: Build
assignee:
  - '@claude'
created_date: '2026-09-07 14:03'
updated_date: '2026-09-07 15:17'
labels: []
dependencies: []
type: bug
ordinal: 90008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the project's documented test command runs every test in src, tools, and client and reports 1150 pass / 0 fail (measured 2026-09-07: 1088 pass across 67 files, then 62 pass across 9 files, chained)
- [ ] #2 bare 'bun test' at the repository root reports 0 failures, so the command README.md:469 tells a reader to type is never a silently passing subset (measured 2026-09-07: 1088 pass / 0 fail with pathIgnorePatterns set; 1093 pass / 57 fail without it)
- [ ] #3 the CLI's subprocess tests in src/cli/rehearsal-cli.test.ts and src/benchmark/benchmark-command.test.ts pass while the client's DOM tests also run, since Bun.spawn's stdio contract was never the cause (probe 2026-09-07: emptying bunfig.toml turns 47 failures into 47 passes)
- [ ] #4 README's check sequence names the command that runs all 1150 tests (source: README.md:469 currently tells a reader to type 'bun test')
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found while building ACT-52 (design system). Confirmed pre-existing: same 48 failures reproduce on main with git stash applied, before any client/ file existed. Error: 'TypeError: stdio must be an array of inherit, ignore, or null / code: ERR_INVALID_ARG_TYPE' at src/cli/rehearsal-cli.test.ts:46 in runCli, which calls Bun.spawn([...], { stdio: [...] }). Every failing test goes through runCli. Not investigated further, out of ACT-52's path.

Correction 2026-09-07: the original title/AC named only rehearsal-cli.test.ts. A fresh full-suite run plus grep on the failure output (mise exec -- bun test, then grep -B3 'stdio must be an array' and grep -c '^(fail)') shows 48 total (fail) lines: 47 through runCli in src/cli/rehearsal-cli.test.ts:46, and 1 through the same-shaped Bun.spawn call in src/benchmark/benchmark-command.test.ts:86, both raising the identical 'TypeError: stdio must be an array of inherit, ignore, or null'. Both still pre-existing and out of ACT-52's path; this only fixes which files a fresh session needs to open.

Cause confirmed 2026-09-07 by probe, and it is not the stdio shape the card's title names. The root bunfig.toml added by ACT-52 preloads client/test-setup.ts into every test process in the repository. That file calls GlobalRegistrator.register(), which installs happy-dom's globals and breaks Bun.spawn for the CLI's subprocess tests. Probe: emptying bunfig.toml takes src/cli/rehearsal-cli.test.ts from 47 fail to 47 pass, with no other change. runCli's Bun.spawn call is valid and untouched by ACT-52.

Three fixes tried and reverted, each measured on the full suite: registering happy-dom only when Bun.argv mentions client/ (57 fail, worse, because a combined run does not name files in argv); moving the preload to client/bunfig.toml (57 fail, the root run stops reading it and client tests lose the DOM); splitting the script into 'bun test src tools && bun test --cwd client' (57 fail, the path filter did not scope the run and all 76 files were still collected).

So the two suites need different globals in one process and Bun's single preload cannot give them that. The next thing to try is running them as two separate bun test invocations that actually scope their file sets, which means establishing how Bun scopes a run before writing the script rather than assuming a path argument does it. Failing that, the DOM registration moves into the client tests themselves rather than a preload.

## Shaped 2026-09-07

Goal: make the repository's documented test command run all 1150 tests green, by giving the client's DOM tests and the CLI's subprocess tests separate processes, because one process cannot hold both sets of globals.

### The mechanism, confirmed

Bun evaluates [test] preload in every test process it starts, including under --isolate. happy-dom's GlobalRegistrator.register() replaces the globals Bun.spawn reads, so any process that loads client/test-setup.ts fails every Bun.spawn call in it. There is no per-glob or per-directory preload key in Bun 1.4.0.

### Unknowns resolved by probe (all 2026-09-07, Bun 1.4.0, this machine)

1. Does a path argument scope a bun test run? Yes, but only with a leading "./". `bun test src tools` collects 76 files because the bare word is a substring filter that also matches client/src. `bun test ./src ./tools` collects 67. This is why the card's third rejected fix appeared not to scope; that rejection was based on the bare form and does not stand.

2. Does --isolate fix it? No. `bun test --isolate` with the preload in place: 1102 pass / 48 fail, unchanged. A fresh global per file still runs the preload.

3. Can the client tests register happy-dom themselves, removing the split? No. Probed with a static `import "../../../test-setup"` placed above the @testing-library/react import, which is the ordering ACT-52 did not try. It still fails with "a global document has to be available". Reason: client/test-setup.ts uses top-level await, so its evaluation does not complete before the sibling static imports in the same module graph. This closes the removal option.

4. Does the split actually work? Yes. `bun test ./src ./tools` gives 1088 pass / 0 fail; `bun test --preload ./client/test-setup.ts ./client` gives 62 pass / 0 fail. Chained with && in one shell: both halves green.

5. Is --cwd client an equivalent second half? No, and it is worse. It gives 61 pass / 1 fail, because .stylelintrc.json's overrides glob is "client/src/system/tokens.css", relative to the root, and stops matching once cwd moves. Keeping cwd at the root and passing --preload avoids inventing a second stylelint config.

### Approach

Removal option (make one process serve both) is ruled out by unknown 3.

Picked: two chained invocations from the repository root, wired into package.json's "test" script.

    "test": "bun test ./src ./tools && bun test --preload ./client/test-setup.ts ./client"

Costs: two Bun startups; the client half's preload path lives in package.json rather than in a config file; anyone adding a top-level test directory must add it to the first invocation or it is silently not run.

Rejected: client/bunfig.toml with --cwd client (breaks the stylelint override glob, unknown 5). Rejected: --isolate (does not work, unknown 2). Rejected: per-file DOM registration (does not work, unknown 3).

### What root bunfig.toml becomes

Deleting the [test] preload is required, or the first invocation still loads happy-dom. Deleting the block leaves bare `bun test` running all 76 files with no DOM: 1093 pass / 57 fail. That is a silent trap for anyone who types the command README.md:469 tells them to type, and there is no CI to catch it. Criterion 3 exists for this. The guard and the README line are open decisions below.

### First test to write

A test that asserts the repository's test script runs both halves, or failing a clean way to assert that, the observation in criterion 1 run by hand and recorded. Start by deleting the preload from bunfig.toml and watching src/cli/rehearsal-cli.test.ts go from 47 fail to 47 pass; that is the red-to-green this card turns on.

### Glossary

No new domain terms. "preload" and "test suite" are tooling, not domain.

## Review disposition 2026-09-07, and a better approach

An independent reviewer checked the shaped record against the repository. Every factual claim above verified. Two findings changed the pick, and one corrected a reason. Both re-probed by this session before acting on them.

### The approach changed: bunfig pathIgnorePatterns, not a path argument

The reviewer found `--path-ignore-patterns`, which the survey above missed. Re-probed here: it also works as the bunfig key `pathIgnorePatterns` (camelCase; snake_case is silently ignored, 76 files instead of 67).

New pick, replacing the two-path-argument version above:

    bunfig.toml:
    [test]
    pathIgnorePatterns = ["**/client/**"]

    package.json:
    "test": "bun test && bun test --path-ignore-patterns \"\" --preload ./client/test-setup.ts ./client"

Measured 2026-09-07, Bun 1.4.0: bare `bun test` at the root gives 1088 pass / 0 fail across 67 files. The second invocation gives 62 pass / 0 fail across 9 files. Chained, both halves green, 1150 total.

Why this beats the `./src ./tools` version:

- Bare `bun test`, which README.md:469 tells a reader to type and which no CI exists to backstop, is now green and correct rather than a silent 57-failure trap. This is what criterion 3 asks for, and it is satisfied by the default rather than by a guard bolted on. The earlier pick had no guard and the notes promised one they did not deliver.
- It is default-inclusive. A new top-level test directory is collected automatically. The `./src ./tools` version drops it silently, which is the same class of defect criterion 3 exists to prevent.
- It does not depend on the leading-"./" substring quirk from unknown 1.

The `--path-ignore-patterns ""` on the second invocation is required: an explicit `./client` path argument still inherits the bunfig ignore and collects 0 files without it (probed: "4 files were searched").

Still rejected, unchanged: `--cwd client` (61 pass / 1 fail, the stylelint override glob; the failing test is the third case in client/src/system/stylelint-tokens.test.ts, which lints tokens.css expecting zero warnings through a root-relative "client/src/system/tokens.css" glob in .stylelintrc.json). `--isolate`. Per-file DOM registration.

### Unknown 3's reason was wrong; its conclusion holds

The notes above blamed top-level await in client/test-setup.ts. That is not the cause. Re-probed with a setup module containing only the GlobalRegistrator.register() call and no await, statically imported above the @testing-library/react import: still fails with "a global document has to be available".

The real reason is ES module hoisting. All static imports of a module are evaluated before any statement in the importing file, so no ordering of static imports can make registration run before @testing-library/react evaluates. This is a language guarantee, not a Bun detail, so the removal option is closed more firmly than the earlier probe showed. A preload is the only mechanism that runs before the module graph.

### Open, for the builder

Criterion 1 says "src, tools, and client". `tools/` currently contains no test files (find tools -type f, 2026-09-07: 20 files, none matching .test/.spec). The criterion is not wrong, since `bun test` collects the directory and finds nothing, but do not hunt for missing tools tests.

The `&&` chain means a first-half failure skips the client half, so a broken CLI test hides whether the client also broke. Accepted: the alternative is running both unconditionally and reporting a combined exit code, which needs a shell script for what is currently one line. Revisit if it bites.
<!-- SECTION:NOTES:END -->
