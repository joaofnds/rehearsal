---
id: ACT-13
title: split run-benchmark.test.ts into per-module test files
status: Build
assignee: []
created_date: '2026-08-30 21:27'
updated_date: '2026-09-01 11:51'
labels: []
dependencies: []
references:
  - run-benchmark.test.ts
  - src/benchmark
  - package.json
type: task
ordinal: 5008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The single test file is over 4000 lines and covers every module in src/benchmark. ACT-3 had to append about 800 lines and coordinate string-level edits with a parallel session in the same file; two sessions editing one test file is now the normal case and the file is the contention point. Split it into one test file per module (bun test picks up *.test.ts anywhere), keeping the shared repository fixtures in a helpers module. Behavior-preserving; the suite must stay green through the split.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every top-level suite migrated from `run-benchmark.test.ts` lives in `src/benchmark/<owner>.test.ts` beside the production module whose public behavior it exercises; the root file is absent, no empty test files are created for untested modules, and existing comparison test files remain focused on their current owners.
- [ ] #2 `benchmark-command.test.ts` and `replay-command.test.ts` each contain separate focused observations for debug dispatch and confirmation dispatch, retaining the exact debug label, projected-cost approval ordering, rep count, and request routing behavior covered before the split.
- [ ] #3 `replay-confirmation.test.ts` and `pipeline-confirmation.test.ts` obtain complete, production-typed dependency and request defaults from shared test harnesses and express each scenario through typed overrides; their test bodies no longer hand-assemble the full dependency records.
- [ ] #4 Shared temporary-directory and Git repository fixtures have one test-support owner, clean up after each scenario, and leave each per-module test independently runnable with `bun test <test-file>`.
- [ ] #5 A pre-split and post-split test-name inventory is identical, including the 310 tests currently in `run-benchmark.test.ts`; the full suite reports zero failures, and `bun run typecheck`, `bun run lint`, and `bun run fmt:check` exit successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: replace the 10,501-line root test contention point with module-owned tests and reusable integration harnesses without changing benchmark behavior or test coverage.

Known starting point:
- `run-benchmark.test.ts` contains 70 top-level suites and 310 tests spanning the public behavior of roughly two dozen modules under `src/benchmark`.
- The full baseline observed on 2026-09-01 is 354 passing tests, 0 failures, and 738 expectations across five files; 44 tests already live in four focused comparison test files.
- Bun discovers `*.test.ts` below `src/benchmark`, so no runner configuration or production entry point needs to change.

Resolved decisions:
1. Colocate each migrated suite at `src/benchmark/<owner>.test.ts`. Ownership follows the production module exporting the subject, not arbitrary line ranges. Several suites from one module share its file; a production module with no current behavioral suite does not receive an empty test file. Existing comparison tests remain where they are.
2. Remove `run-benchmark.test.ts` after its final suite moves. Do not leave a compatibility aggregator because it would preserve duplicate discovery and the contention point.
3. Put test-only infrastructure below `src/benchmark/test-support/`. Repository creation, commits, temporary-root registration, and cleanup have one owner. Production modules never import test support.
4. Give replay and pipeline confirmation integration tests reusable, typed harnesses that construct complete valid dependency and request defaults. A scenario supplies only meaningful overrides and then observes records, filesystem state, logs, or captured boundary inputs. Keep real Git/worktree and managed filesystem behavior where the existing integration test depends on it; fake provider and other unmanaged boundaries through the exported dependency interfaces.
5. Keep command dispatch at the narrow command boundary: `benchmark-command.test.ts` and `replay-command.test.ts` each retain distinct debug and confirmation cases rather than folding both modes into one broad integration case.
6. Migrate in small green steps, starting with low-dependency pure suites, then filesystem/Git suites, then replay and confirmation integrations. After each file move, run that file directly and remove the corresponding root suites in the same step so discovery never duplicates them. Record a sorted test-name inventory immediately before the first move and compare it after the root file is removed.
7. Preserve test names, assertions, and public production code unless extracting the shared harness reveals a test-only compile boundary. This is a refactor, so it stays green; no behavioral red is expected.

Likely interfaces to move:
- Module-owned `src/benchmark/*.test.ts` files for the subjects currently covered by the root suite.
- Test-only repository and cleanup support under `src/benchmark/test-support/`.
- Typed replay-confirmation and pipeline-confirmation harnesses or builders under the same test-support boundary, with scenario override points.

Deliberately unchanged: production APIs and behavior, persisted schemas and bytes, CLI output, benchmark costs or provider execution, comparison tests, and Bun configuration.

Glossary terms added: none. The task changes test ownership and support structure only; no domain language changes.

First test file to create: move the unchanged `parseArgs` and `parseReplayArgs` suites into `src/benchmark/config.test.ts`, delete those suites from the root file in the same edit, run `bun test src/benchmark/config.test.ts`, then run the full suite and compare the test-name inventory. This refactoring step is expected to remain green rather than produce a red assertion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped on 2026-09-01 from ACT-13, CLAUDE.md, GLOSSARY.md, package scripts, the full root test suite, the existing comparison test layout, confirmation dependency interfaces, ACT-5 and ACT-21 review handoffs, and the task creation history.

Unknowns resolved from repository evidence:
- Test location: existing comparison tests are colocated under `src/benchmark`, and Bun already discovers them. Use the same convention.
- Meaning of per-module: one file per currently tested production owner, not one file per individual function and not empty files for uncovered modules.
- Shared support boundary: the repeated `createRepository`, `commitAll`, temporary-directory cleanup, replay dependency setup, and full pipeline dependency records are test infrastructure. Keep them out of production modules and expose typed harness APIs to tests.
- Confirmation harness behavior: the exported `ReplayDependencies` and `PipelineConfirmationDependencies` contracts provide the production shape. Harness defaults satisfy the complete contract; scenarios override only the relevant provider or failure seam.
- Coverage baseline: `bun test` currently reports 354 pass, 0 fail, and 738 expectations across five files. The root file contributes 310 tests and the four comparison files contribute 44.
- No paid benchmark or provider run is needed; this task changes test organization only.

No decision was deferred.
<!-- SECTION:NOTES:END -->
