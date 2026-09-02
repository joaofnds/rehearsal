---
id: ACT-26.4
title: declare benchmark cases as data and run any of them
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 22:42'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 25008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today there is exactly one case, hardcoded: backlog-seed.md, product-brief.md, rubric.md, and rubrics/ at the control root, the target from --target, the pipeline from --pipeline. A second task, or ACT-25's non-pipeline case, has nowhere to go. Move the case to cases/audit-log/ (task, brief, final rubric, stage rubrics, pipeline, target declaration) and make it the default when --case is absent. rehearsal run --case <id> runs any declared case; rehearsal case list and case show read them; the run, group, and comparison records name the case they ran, and comparison pairs arms per case as the glossary already says. Cases live in this repository, never beside the corpus: the dotfiles evals sat beside the agent they graded and were deleted with it at the corpus swap.

This is the prerequisite for ACT-26.5 and the first thing the scripts needed. Gap 1 in doc-1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 cases/audit-log/case.json exists and declares kind pipeline; the task, product brief, final rubric, stage rubrics, and pipeline it names are files under cases/audit-log/, and backlog-seed.md, product-brief.md, rubric.md, rubrics/, and pipelines/ no longer exist at the control root
- [x] #2 A characterization test asserts the bytes loadCase("audit-log") returns for task, productBrief, finalRubric, each stage rubric, and the pipeline definition equal the bytes the control-root files held at the commit before the move
- [x] #3 bun run rehearsal case list exits 0 and prints one line per case directory, including audit-log with its declared title
- [x] #4 bun run rehearsal case show audit-log --json exits 0 and prints exactly the parsed case declaration as JSON, which the same zod schema that loaded it accepts, and stdout parses with JSON.parse
- [x] #5 bun run rehearsal case show missing exits 3 and names the unknown case on stderr, printing nothing on stdout
- [x] #6 bun run rehearsal run --case missing --target <dir> --model sonnet --session-budget-usd 1 exits 3 naming the unknown case, before the target is claimed: the target repository's git status is unchanged and no run directory is created under .benchmark-runs
- [x] #7 bun run rehearsal run --help lists --case with its default audit-log and its BENCHMARK_CASE environment variable
- [x] #8 A case declaration whose id does not equal its directory name is refused at load with an error naming both, and a case declaration naming a path outside its case directory (a leading slash or a .. segment) is refused with an error naming that path
- [x] #9 A run with --case absent and a run with --case audit-log produce the same loaded case: a test asserts the two resolved CaseDeclaration values are equal
- [x] #10 The run manifest, run artifact, confirmation group record, and confirmation rep record each carry caseId, and a test asserts a record written by a run of the audit-log case has caseId audit-log
- [x] #11 loadRunManifest, parseConfirmationGroupRecord, and parseConfirmationRepRecord each accept a record with no caseId and return caseId audit-log, and the confirmation records keep schemaVersion 1 while the comparison report keeps schemaVersion 2
- [x] #12 assertComparableComparison refuses a comparison whose manifest case names caseId X while one of its arm groups recorded a different caseId, with an error naming the case, the arm, and both ids
- [x] #13 The comparison report names the case each of its cases ran: a report built from groups that recorded caseId audit-log carries that id, and parseComparisonReport accepts it
- [x] #14 bun run rehearsal run --case audit-log --pipeline <other path> records the overriding pipeline path in the artifact, showing --pipeline still overrides the case's declared pipeline
- [x] #15 bun run rehearsal run --case audit-log with neither --target nor BENCHMARK_TARGET_DIR uses the target the case declares, and --target overrides it: a config parse test asserts both sourceDir values
- [x] #16 echo | bun run rehearsal run --case audit-log --confirm --reps 2 --yes --model sonnet --session-budget-usd 1 --target <nonexistent dir> loads the whole case (pipeline, both stage rubrics, task, brief, final rubric) and then fails on the target, with no provider call made
- [x] #17 The README describes cases/<id>/ as the case layout in every section that described the root files, and its Running section shows rehearsal run --case
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Goal

A benchmark case becomes declared data under `cases/<id>/`, so a second task has
somewhere to go: `rehearsal run --case <id>` runs any declared case, `case list`
and `case show` read them, and every record names the case it ran.

## Unknowns, and how each was resolved from the repository

1. **Where a case's pipeline and rubrics live after the move, and whether
   `loadPipeline` can still find them.** Read the code: `loadPipeline`
   (src/benchmark/pipeline.ts) resolves the pipeline path against `CONTROL_DIR`,
   refuses anything outside it, and builds `availableRubrics` by reading
   `join(CONTROL_DIR, "rubrics")` and relativizing each entry against
   `CONTROL_DIR`. A stage's `rubric` field is therefore a control-relative string
   (`rubrics/shape.json`) that must literally appear in that listing. Resolved:
   the rubrics directory becomes a parameter of the load, supplied by the case
   (`cases/audit-log/rubrics`), and stage rubric strings stay control-relative
   (`cases/audit-log/rubrics/shape.json`) so `pipelinePath` and the frozen-file
   paths recorded in group records keep the one stable spelling comparability
   already compares (`inputs.pipelinePath`, checked in
   comparison-comparability.ts).
2. **Whether the run artifact needs a legacy-parse path for `caseId`.** Read the
   code: `RunArtifact` is a TypeScript interface in contracts.ts, written by
   `buildRunArtifact` and never parsed back — no zod schema, and the only reader
   of an `artifact.json` in the repository is a test. Resolved: `caseId` is a
   plain required field there; the compiler is the whole guard. The legacy
   question is real only for `loadRunManifest`, `parseConfirmationGroupRecord`,
   and `parseConfirmationRepRecord`, which do parse from disk.
3. **Whether making `caseId` optional in the confirmation schemas weakens the
   write path.** Read the code: `confirmationGroupRecordSchema` both writes
   (confirmation-evidence.ts:224, parsing a literal it just built) and reads
   (`parseConfirmationGroupRecord`). A bare `.default()` would silently fill an
   omitted `caseId` on write too. Resolved: `caseId` becomes a required field of
   the `ConfirmationFinalization` input type, so the compiler refuses a write
   without one, while the schema field stays `.optional().default("audit-log")`
   for the read. Write-side strictness in the types, read-side tolerance in the
   schema.
4. **The precedent for an absent field with a stated legacy meaning.**
   `manifest.ts` already does exactly this: `legacyRunManifestSchema` omits
   `target` and `loadRunManifest` fills it from a named `LEGACY_TARGET_DEFINITION`
   constant with a comment. Resolved: `caseId` follows the same shape, with the
   default named as a constant (`LEGACY_CASE_ID = "audit-log"`) carrying the
   reason in a comment, so no version bump is needed for confirmation records (v1)
   or the comparison report (v2), as decision policy rule 4 requires.
5. **How `case list` and `case show <id>` fit a command table that allows one
   command name token and one positional.** Read the code: `parseCommandLine`
   accepts at most one positional (`command.argument`), and `findCommand` matches
   `Bun.argv[2]` alone. `case show <id>` needs a sub-verb plus an argument.
   Resolved: two entries in the same `COMMANDS` table, named `"case list"` and
   `"case show"`, and `findCommand` matches the longest declared name against the
   leading argv tokens. Two consumers change (`findCommand` in rehearsal.ts, the
   `topLevelHelp` padding); the table stays the single source of every name, flag,
   and help line, which is the property ACT-26.1 built it for.
6. **Whether `caseId` already exists somewhere and would collide.** Grepped:
   `caseId` is already the identity of a case in the comparison manifest, the
   comparison loader, and the comparison report, where it is a free-form
   `identitySchema` string that today happens to be `case-1`/`case-2` in fixtures.
   Resolved: it is the same concept, so the field name stays and its meaning
   narrows to "a declared case id"; the narrowing is enforced by the new
   comparability rule (criterion 12), not by a rename.
7. **What `--case` does when `--target` is also absent.** The card's direction
   gives a `pipeline` case a `target: { path }`. Today `parseArgs` throws
   "Provide --target or BENCHMARK_TARGET_DIR" before anything is loaded. Resolved:
   the case's declared target becomes the last fallback in that chain, after
   `--target` and `BENCHMARK_TARGET_DIR`, which means the case must be loaded
   before the target is resolved. So the load order in `run` is: parse flags,
   load the case, then resolve the target from flag, environment, or the case.
   The existing error stays for the case where no case declares one.
8. **Whether the observation the dispatch describes is reachable without a paid
   call.** Read ACT-26.1's record and its review fixes: after commit b82292a,
   `run --confirm` without `--yes` and without a TTY exits 3 at the approval gate,
   while `--confirm --yes` proceeds to the cost projection and the target check.
   Resolved: the end-to-end case-load observation must use `--yes` and a target
   that fails, so the run loads case, pipeline, rubrics, task, brief, and final
   rubric and then dies at `assertSourceReady`. That is criterion 16, and it is
   why it is worded around a nonexistent target rather than around the approval
   prompt.
9. **How wide the move ripples.** Grepped for the moved paths: 32 files name
   `backlog-seed.md`, `product-brief.md`, `rubric.md`, `rubrics/`, or
   `pipelines/default.json`, of which the production ones are pipeline.ts,
   stage-grading.ts, run.ts, calibration.ts, pipeline-confirmation.ts,
   replay-confirmation.ts, backlog.ts, and src/cli/run-command.ts. Two of them
   (run.ts:735 and run-command.ts:152) read the same four root files
   independently, on the debug and confirmation paths. Resolved: the loader is
   introduced first and both call sites are pointed at it, which removes that
   duplication as a side effect of the move rather than as separate work.
10. **Whether `stage-grading.ts`'s citation paths must move too.**
    `validateStageJudgeEvidence` maps the `task` source to the literal
    `["backlog-seed.md"]` and `product-brief` to `["product-brief.md"]`, and the
    Judge prompt names both files. Resolved: those are the names of the *sources
    in the Judge's evidence envelope*, not paths on this machine, and the Judge
    never sees the control repository. They stay as they are; changing them would
    invalidate every recorded scorecard's citations for no gain. Recorded here so
    Build does not "fix" them along with the real paths.

## Decided autonomously

Nobody answers questions in this run. Each decision follows the dispatch's
decision policy in its stated order and can be reversed by João.

1. **The rubrics directory becomes a parameter of `loadPipeline`, supplied by the
   case; stage `rubric` strings stay control-relative.** Reason: policy rule 2,
   smallest coherent scope. The alternative, making stage rubric strings
   case-relative, changes the spelling recorded in every group record's
   `inputs.files` and in `inputs.pipelinePath`, which comparability compares
   across arms — a records change where none is needed.
2. **`case list` and `case show` are two entries in the existing `COMMANDS`
   table with two-word names, not a new sub-parser.** Reason: doctrine §12's
   YAGNI over generality and ACT-26.1's structural claim that the table is the
   single source of names, flags, and help. A nested sub-command parser is a
   second dialect for two verbs.
3. **An unknown case is a refused precondition (exit 3), not a usage error
   (exit 2).** Reason: the glossary's Exit code entry, settled at ACT-26.1 Shape,
   puts "a needed approval whose flag is absent" and "a run that cannot be
   replayed" under 3 and reserves 2 for "unknown flag, missing required flag,
   unparseable value". `--case missing` is a well-formed flag naming something
   that does not exist, which is the refused-precondition shape, and ACT-26.1's
   ruling 12 already settled that the glossary wins on this question.
4. **The case's declared target is the last fallback, after `--target` and
   `BENCHMARK_TARGET_DIR`.** Reason: the card's direction states `--target` and
   `BENCHMARK_TARGET_DIR` still override, and the existing chain is flag then
   environment; appending the case keeps one ordering rather than two.
5. **`caseId` is required on the write side (in the record input types) and
   optional-with-legacy-default on the read side (in the zod schemas), with no
   version bump.** Reason: decision policy rule 4, and the `LEGACY_TARGET_DEFINITION`
   precedent in manifest.ts. Every record on disk without a `caseId` ran the
   audit-log case, so `audit-log` is the field's true legacy value, not a guess.
6. **The case declaration's `kind` is a zod discriminated union with the single
   member `pipeline`.** Reason: the card settles it, and it is also what §5's
   parse-don't-validate asks for: adding `session` in ACT-26.5 then cannot make a
   case that carries both kinds' inputs.
7. **Path traversal is refused by the loader, not by the schema's string type.**
   Reason: the refusal needs the case directory to resolve against, which the
   schema does not have. `loadPipeline` already refuses a pipeline outside
   `CONTROL_DIR` this way, so the check reads the same as the one beside it.
8. **The case's pipeline stays a separate file (`cases/<id>/pipelines/default.json`)
   rather than being inlined into `case.json`.** Reason: `--pipeline` must keep
   overriding it with another file path, which only works if a pipeline is a file;
   and `pipelinePath` is recorded in the artifact and compared across arms today.
9. **`case show` prints the parsed declaration, not the raw `case.json` bytes.**
   Reason: the glossary's Command record entry — `--json` prints the strict,
   zod-validated record, never a second shape. The parsed declaration is that
   record; the raw file is a second shape that could differ from what the harness
   would actually load.

## Not built, and why

Each is named by the card, doc-1, or the surrounding design, and has no case in
this card. The trigger that would build it is named.

- **The `session` case kind.** ACT-26.5. Trigger: that card. This card only
  leaves `kind` a discriminated union so the second member is an addition.
- **`--corpus` and corpus variants.** ACT-26.6. The corpus under test stays the
  live `CLAUDE.md` plus the installed skills; a case is the frozen task, not the
  corpus. Trigger: that card.
- **`case capture`.** ACT-26.5, where it captures a session transcript. There is
  no pipeline case to capture. Trigger: that card.
- **A second declared case.** ACT-25 is the first real one and is a session case.
  Declaring a second pipeline case here would be a fixture with no user, and the
  loader is proven by `audit-log` plus unit tests over refused declarations.
  Trigger: a real second pipeline task.
- **Moving `CLAUDE.md` into the case directory.** It is corpus, not case; the
  glossary's Corpus entry and design decision 5 both place it at the control root.
  Trigger: none; it would be wrong.
- **A `cases/` schema version or migration tool.** No case declaration exists on
  disk yet, so there is nothing to migrate. Trigger: the first change to
  `case.json`'s shape after a case has been declared for a while.
- **Renaming the comparison manifest's `caseId`.** It already means what this
  card needs it to mean. Trigger: none.
- **Changing the Judge's evidence source names (`backlog-seed.md`,
  `product-brief.md` in stage-grading.ts).** They name sources in the evidence
  envelope, not files on this machine; changing them invalidates recorded
  citations. Trigger: a Judge that is given real paths.

## Implementation plan

Ordered so every step is committable, the suite stays green at each, and the
characterization comes before the move.

1. **Characterize the case as it is today.** Before any production code:
   `src/benchmark/case.test.ts` asserts that loading the audit-log case yields
   task, product brief, final rubric, both stage rubrics, and the pipeline
   definition byte-identical to the control-root files. It fails because the
   module does not exist; the bytes it expects are read from the root files it
   is about to make obsolete, so the move cannot change them silently.
2. **The case loader, still pointing at the root.** `src/benchmark/case.ts`:
   `caseDeclarationSchema` (discriminated on `kind`, one member), `loadCase(id)`,
   `listCases()`, and the traversal and id-matches-directory refusals. Declare
   `cases/audit-log/case.json` whose paths point at the root files for one
   commit. Green.
3. **Move the files.** `git mv` the five inputs into `cases/audit-log/` and point
   the declaration at their new homes. Same commit: `loadPipeline` takes its
   rubrics directory as a parameter, and the stage `rubric` strings in the moved
   pipeline become `cases/audit-log/rubrics/*.json`. The characterization from
   step 1 is what proves the move changed nothing.
4. **Point the two duplicate readers at the loader.** run.ts:735 and
   run-command.ts:152 both read the four root files; both take the loaded case
   instead. calibration.ts's edit-these-files message names the case's paths.
5. **`--case` on run.** The flag in the command table with its `BENCHMARK_CASE`
   fallback and `audit-log` default; `parseArgs` returns the case id; the run
   command loads the case before resolving the target, and the case's declared
   target becomes the last fallback in the chain. An unknown case throws the
   refused-precondition error before the target is claimed.
6. **`case list` and `case show`.** The two table entries, `findCommand` matching
   the longer name first, and `src/cli/case-command.ts`. `case show` prints the
   parsed declaration through the existing `writeRecord` path.
7. **`caseId` on the records.** The manifest, the run artifact inputs, the
   confirmation finalization input, and the group and rep schemas; the legacy
   default constant with its comment; the parsers' tests for an absent field.
8. **Comparability.** The one new rule: every arm of a manifest case is a group
   whose `caseId` equals that case's `caseId`, refused with the case, the arm,
   and both ids named. The comparison report carries the id it already has.
9. **README and CLAUDE.md.** Every section that described the root layout, the
   Running section's `--case`, and the control-file reference list.

## First test to write

In `src/benchmark/case.test.ts`, before `src/benchmark/case.ts` exists:

> `loadCase` returns the audit-log case's inputs byte-for-byte as the control
> root holds them

Arrange nothing but the repository; act by calling `loadCase("audit-log")`;
assert `task`, `productBrief`, and `finalRubric` equal the current bytes of
`backlog-seed.md`, `product-brief.md`, and `rubric.md`, that the stage rubrics
equal the current `rubrics/shape.json` and `rubrics/build.json`, and that the
pipeline equals the parse of `pipelines/default.json`. It fails now because the
module does not exist. It is the characterization that lets step 3 move five
files without trusting a reading of the diff, and it is the test that makes the
case loader — rather than eight scattered `join(CONTROL_DIR, ...)` calls — the
one place that knows where a case's inputs live.

The second test is `rehearsal case show missing` exits 3 with the case named on
stderr and nothing on stdout, which forces the refused-precondition error type,
the two-word command name in the table, and `findCommand`'s longest-match into
existence together.

## Decided autonomously at Build

Each follows the dispatch's decision policy. The nine decisions the Shape record
already carries stand; these are the ones Build had to add.

1. **The loader and the move landed in one commit, not two.** The plan's step 2
   declared the case with paths pointing at the control root for one commit.
   That is impossible: the traversal refusal the same step introduces rejects
   `../../backlog-seed.md`, and it fired the first time it ran. The
   characterization instead reads the pre-move bytes from Git at
   `ccfdeb017667a0a1db9027a5e014b7e5650b7935`, which is what criterion 2 asks
   for and what makes the move provable without the intermediate commit.
2. **`CaseDeclarationError` is a plain `Error`; the CLI turns it into the exit-3
   refusal.** Reason: policy rule 2 and the existing precedent. No module under
   `src/benchmark/` imports `#cli/`, and `src/cli/replay-command.ts:267` already
   raises `RefusedPreconditionError` for the same shape of failure (a named but
   absent run). `src/cli/case-command.ts`'s `asRefusedPrecondition` does the
   translation in one place.
3. **`--pipeline` resolves into the loaded case (`withPipeline`), not alongside
   it.** Reason: a pipeline names its stages' rubrics, so overriding the pipeline
   without reloading the stage rubrics would hand the run a pipeline its rubric
   map no longer matches. The override produces a whole case.
4. **The replay group's `caseId` comes from the run manifest it replays, not from
   a flag.** Reason: a replay reruns that run's case by definition, and
   `frozen.manifest` is already loaded where the records are built. It is not on
   `ReplayConfirmationRequest`, so a caller cannot claim a different case.
5. **`LEGACY_CASE_ID` and `DEFAULT_CASE_ID` live in `config.ts`, not `case.ts`.**
   Reason: `manifest.ts` and `confirmation-record.ts` need the legacy default and
   must not import `case.ts`, which pulls in `pipeline.ts` and
   `stage-grading.ts`. `config.ts` already owns `CONTROL_DIR`.
6. **The case loads before the stdin gate in `runRunCommand`.** Reason: the case
   declares the target, so it must load before the configuration resolves. Both
   refusals exit 3, and loading a case touches nothing, so the reordering costs
   nothing observable. The test that asserted "refuses before loading the
   pipeline" now asserts "refuses before the run starts".
7. **The obsolete `runBenchmark` test "rejects a malformed pipeline before
   claiming the target" was removed, not rewritten in place.** Reason:
   `runBenchmark` no longer loads a pipeline. The behavior it protected still
   holds and is now proven where it lives: `runRunCommand` loads the case (and
   any `--pipeline` override) before `execute`, covered by "refuses an unknown
   case before the run starts" in `src/cli/run-command.test.ts` and observed
   directly against a real target repository (criterion 6).
8. **`ComparisonEvidenceFixture` takes its case ids at construction.** Reason:
   the new comparability rule requires each arm's group to record the case its
   manifest entry names, and the oversized-manifest CLI test composes six fixture
   roots into one manifest, which needs ids unique across them. Both sides now
   read the ids from the fixture.
9. **The `--target`-missing CLI test became a `--model`-missing test.** Reason:
   with the case declaring a target, "Provide --target or BENCHMARK_TARGET_DIR"
   is no longer reachable from a declared case. The exit-2 usage-error behavior
   it protected is unchanged and is still covered, through the next required
   flag.

## Defect found and fixed

Commit `b398a96` staged the rename of `pipelines/default.json` but not its
content change, so at that commit the pipeline still named `rubrics/shape.json`
and `rubrics/build.json` at the control root, where nothing exists any more, and
`loadCase("audit-log")` failed on both stages. Caught by stashing the
working-tree change and re-running `bun test src/benchmark/case.test.ts`, which
went to 4 fail. Fixed forward in `fb71c6a`; history was not rewritten. The cause
is `git add` on a path git had staged as a rename: the rename covers the path,
not the later edit.

## What changed

- `src/benchmark/case.ts` is new: `caseDeclarationSchema` (a zod discriminated
  union on `kind` with one member, `pipeline`), `parseCaseDeclaration`,
  `readCaseDeclaration`, `listCases`, `loadCase`, `withPipeline`, and
  `caseRelative`, which refuses any path resolving outside the case directory.
- `cases/audit-log/` holds the moved `backlog-seed.md`, `product-brief.md`,
  `rubric.md`, `rubrics/`, and `pipelines/`, plus `case.json`. Nothing of the
  five remains at the control root.
- `loadPipeline` takes its rubrics directory as a parameter. Stage `rubric`
  strings stay control-relative (`cases/audit-log/rubrics/shape.json`), so
  `inputs.pipelinePath` and the frozen-file paths comparability compares keep
  one spelling.
- `src/cli/case-command.ts` is new: `runCaseList`, `runCaseShow`, and
  `requireCase`, the last of which is the run command's case loader.
- `COMMANDS` gains `--case` on `run` and two two-word entries, `case list` and
  `case show`. `findCommand` moved into `commands.ts` and matches the longest
  declared name against the leading argv tokens.
- `parseCaseId` is new; `parseArgs` takes a required `CaseDefaults` and resolves
  the target from `--target`, then `BENCHMARK_TARGET_DIR`, then the case.
- `caseId` is on the run manifest, the run artifact, and the confirmation group
  and rep records. Optional with `LEGACY_CASE_ID` on the read side, required on
  the write side through the record input types; no version bump.
- `assertComparableComparison` gains `assertArmRanTheCase`.
- `runBenchmark` and `confirmRun` take the loaded case instead of reading the
  four root files themselves, which removed the duplication at `run.ts:735` and
  `run-command.ts:152`. `collectCalibration` takes `finalRubricPath` and
  `rubricsDirectory` rather than assuming the control root.
- README, CLAUDE.md, and GLOSSARY.md describe the case layout, the two new
  commands, and `--case`.

## Refactor pass

The task exposed the same duplication on the corpus half that the case loader
removed on the case half: four modules built `join(CONTROL_DIR, "CLAUDE.md")`
for themselves and a fifth interpolated it into calibration's edit-target
message. `PROJECT_INSTRUCTIONS_PATH` and `readProjectInstructions` in
`config.ts` are now the one home (`116f8f7`); `calibration.ts` and both CLI
command modules no longer import `node:path` or `CONTROL_DIR` at all.

## Observed directly, and how

Every claim below is a tool result from this dispatch. No paid provider call was
made, and none was needed; total spend on provider calls: $0.00.

- `bun rehearsal.ts case list` printed `audit-log` with its title, exit 0.
- `bun rehearsal.ts case show audit-log --json` printed the parsed declaration,
  exit 0, stdout parsed with `JSON.parse`.
- `bun rehearsal.ts case show missing` exited 3, stderr named the case, stdout
  was 0 bytes.
- `bun rehearsal.ts run --case missing --target <real git repo> ...` exited 3
  naming the case; `git -C <target> status --porcelain` was empty afterwards and
  `.benchmark-runs` gained no directory.
- `bun rehearsal.ts run --help` listed `--case` with `default audit-log, env
  BENCHMARK_CASE`.
- Criterion 16 was observed twice over. `echo | ... run --case audit-log
  --confirm --reps 2 --yes --target /nonexistent-target-dir` reached the cost
  projection and then died on the target with no run directory created. That the
  *whole* case loads first was proven by hiding each of the six inputs in turn
  and re-running: each produced its own distinct failure (three ENOENTs naming
  the moved files, two "names a missing rubric", one "Pipeline definition not
  found"), every one of them before the cost-projection line.
- `bun run typecheck`, `bun run lint`, `bun run fmt:check`, and `bun test` each
  exited 0 at `116f8f7`, with 551 tests passing. `git status` is clean.

## Not verified

- No run, replay, confirmation, or comparison was executed against a live
  provider, so the `caseId` on records written by a *real* session is proven by
  `runPipelineConfirmation`'s fake-backed test, not by a recorded run on disk.
  There is still no run artifact under `.benchmark-runs`.
- The declared target `../../../nestjs-template` was never resolved to a real
  repository; criterion 15's fallback is proven by the config parse test the
  criterion names, not by a run against that path.
- The legacy `caseId` path is proven by parsing synthesized legacy records; no
  pre-change record exists on disk to read.

## What became possible but is not wired up

- A second declared case now has somewhere to go, but only `audit-log` exists.
  `case list` iterating `cases/` will pick up a second directory with no code
  change.
- `case.json`'s `kind` is a discriminated union with one member, so ACT-26.5 adds
  `session` as a second member rather than reshaping the type. Nothing else
  branches on `kind` yet.
- The empty `pipelines/` directory `git mv` left at the control root was removed
  from the working tree; it was untracked and empty, so no commit records it.

## Review

Due. The change touches the record schemas every recorded run and comparison is
read through, moves five committed files, and adds a comparability rule that can
refuse evidence.

## Review fixes

Seven findings from the ACT-26.4 review, each fixed in its own commit, test
first where a test could pin it. The card's status was not moved.

1. **The shipped case declared a target that resolved nowhere** (`79ab2e7`).
   `loadCase("audit-log").targetPath` was `/Users/nestjs-template`, which does
   not exist, so a run with neither `--target` nor `BENCHMARK_TARGET_DIR`, the
   invocation criterion 15 and the README describe, died at `assertSourceReady`.
   Two tests pin it: the resolved target is a directory that exists, and a
   relative target resolves against the case directory. Observed:
   `loadCase("audit-log")` now returns `/Users/joaofnds/code/nest/template` and
   `stat` reports it a directory.
2. **The comparability rule refused legacy confirmation records** (`c34cebd`).
   The loader now records what the group file actually declared, separate from
   the record every other reader sees, and `assertArmRanTheCase` refuses only a
   declared id that disagrees. Pinned both ways: a legacy group with no `caseId`
   loads in a manifest named `case-1`, and a group carrying a different id is
   still refused naming the case, the arm, and both ids. The legacy default is
   unchanged for every other reader.
3. **The `caseId` write path was unpinned** (`831aa18`). The criterion-10 test
   now drives `audit-log-follow-up`, a case id that is not the schema fallback,
   so the reviewer's deletions fail. Verified by repeating all three mutations:
   deleting the four `caseId` lines in `pipeline-confirmation.ts` fails the
   criterion-10 test and the group site fails to compile
   (`ConfirmationGroupFinalization` already requires the field); deleting
   `confirmation-evidence.ts:227` fails the same test; replacing the CLI's
   `caseId` with `"WRONG"` fails the new `buildConfirmationRequest` test.
4. **One unreadable directory hid every valid case** (`f3c567c`). `listCases`
   returns readable declarations and unreadable directories separately.
   Observed: with `cases/zz-stray-probe` present, `rehearsal case list` exits 0,
   prints `audit-log` on stdout and the unreadable directory on stderr, checked
   by redirecting each stream separately.
5. **`case list` crashed with a raw ENOENT when `cases/` was absent**
   (`3a31207`). It now raises the module's own `CaseDeclarationError`, which
   `asRefusedPrecondition` translates. Observed: with `cases/` moved aside,
   `rehearsal case list` prints `No case directory at cases` and exits 3.
6. **`bun test` recreated an untracked `pipelines/` at the control root**
   (`8e67abb`). Both sites write into a temporary directory under the control
   root, tracked by `TestResources` before it holds anything. Observed: removed
   `pipelines/`, ran the full suite, and it did not return; no stray
   `rehearsal-test-*` directory was left and `cases/audit-log/pipelines/` still
   holds only `default.json`.
7. **The empty-target guard was unreachable in tests** (`591a2c6`). Kept, with a
   test naming the one live branch. Verified the test fails when the guard is
   deleted.

## Decided autonomously, at the review fixes

Nobody answers questions in this run. Each decision follows the dispatch's
decision policy and can be reversed by João.

1. **A relative `target.path` resolves against the case directory, and the
   audit-log case declares `../../../nest/template`.** Reason: every other path
   in a declaration already resolves against the case directory through
   `caseRelative`, and the reviewer named the two-base split as the
   inconsistency. One base for the whole declaration. `target.path` is still not
   run through `caseRelative`, because a case may legitimately name a repository
   outside its own directory; a comment on `declaredTarget` records that. The
   README no longer both passes `--target` and claims the case supplies it.
2. **An unreadable case directory is reported on stderr while the valid lines
   print on stdout and the exit stays 0.** Reason: a silent skip hides a
   half-written case from the person who half-wrote it, and the glossary's exit
   codes reserve a nonzero exit for a refused command. The listing is still the
   record on stdout, so `--json` is unaffected.
3. **The `sourceDir === ""` guard stays, rather than being deleted as dead.**
   Reason: `resolve("")` is the process's working directory, so without the
   guard `BENCHMARK_TARGET_DIR=""` silently points a run at the control
   repository instead of refusing. That branch is live and now has a test.
4. **Finding 3's compiler guard stops at the record-input types that already
   exist; no branded case-id type was introduced.** Reason: policy rule 2,
   smallest coherent scope. A branded string would be new machinery with no
   precedent in this repository, and the dispatch's bar is "fail to compile or
   fail a test". Every mutation the reviewer performed now does one or the
   other. Reshaping `PipelineConfirmationRequest` to carry the loaded
   `BenchmarkCase` instead of copying seven of its fields is the real structural
   opportunity here, and it is a task, not a review fix.

## Recorded, no code change

- **Note 9.** `caseId` is validated three ways for one concept: `case.ts`'s
  strict lowercase regex, `confirmation-record.ts`'s looser identity regex, and
  `manifest.ts`'s bare `min(1)`, with the loosest on the record read back from
  disk. No reachable bad path was found. Left as is: tightening the disk-side
  schemas would refuse records that are already valid, which is a records change
  with no defect behind it.
- **Note 11.** `case list` without `--json` prints a tab-separated id and title,
  while the glossary says a command never prints a second summary-only shape and
  `case show` prints a path. Criterion 3 demanded the listing, so the criterion
  and the glossary conflict. Recorded as a decision rather than fixed: the
  criterion is the settled constraint for this card, and changing the glossary is
  João's to make.
- **Note 12.** Loading the case precedes the TTY refusal, forced by criterion 15,
  so a refused run reads the case files first. All reads are read-only inside the
  control repository and no target is claimed; criterion 6 still holds.
- **Note 14.** The criterion-13 loader test passes with the comparability rule
  deleted, so its title claims more than it checks. The rule itself is pinned by
  `comparison-comparability.test.ts`, including the two new directions above.
- **Note 8.** The review patch included a `.gitignore` hunk not in the
  repository, because `chore: unignore backlog` landed mid-run. The reviewer read
  the repository at HEAD, which is correct. No action.

## Observed at the review fixes, and how

Every claim is a tool result from this dispatch. No paid provider call was made;
total spend on provider calls: $0.00.

- `loadCase("audit-log")` printed `/Users/joaofnds/code/nest/template` and
  `stat(...).isDirectory()` was `true`.
- `bun rehearsal.ts case list` with a stray `cases/zz-stray-probe`: exit 0,
  `audit-log` and its title on stdout, the stray's reason on stderr, each stream
  checked separately by redirecting the other to `/dev/null`.
- `bun rehearsal.ts case list` with `cases/` moved aside: `No case directory at
  cases`, exit 3.
- Removed `pipelines/`, ran `bun test`, and `ls -d pipelines` still reported no
  such file.
- Each of the reviewer's three mutations reproduced and confirmed to now fail:
  the four `caseId` deletions in `pipeline-confirmation.ts` (one a compile
  error, the rest a test failure), the `confirmation-evidence.ts` deletion, and
  `caseId: "WRONG"` in the CLI wiring. Deleting the `sourceDir === ""` guard now
  fails its new test, and reverting the comparability change fails the new
  legacy-record test.
- `bun run typecheck`, `bun run lint`, `bun run fmt:check`, and `bun test` each
  exited 0 at the final commit, with 560 tests passing. `git status` is clean.

## Not verified at the review fixes

- No run, replay, confirmation, or comparison was executed against a live
  provider. The `caseId` on records written by a real session is still proven by
  fake-backed tests, not by a recorded run on disk.
- The declared target now resolves to a real directory, verified by `stat`. No
  run was executed against it, so nothing here shows the harness completing a run
  from the case's declared target.
- The legacy `caseId` path is still proven by synthesized legacy records; no
  pre-change record exists on disk to read.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-02 22:42
---
Independent review (reviewer agent, one round). Full check at close: typecheck, lint, fmt:check exit 0; bun test 560 pass, 0 fail across 45 files. Axes applied: style, architecture, security, spec conformance, testing, refactoring. No axis skipped.

BLOCKING, both fixed and re-observed by the orchestrator.

1. The shipped case declared a target that resolved nowhere. cases/audit-log/case.json named ../../../nestjs-template, which resolved against CONTROL_DIR to /Users/nestjs-template; read as case-relative it would be /Users/joaofnds/code/nestjs-template. Neither exists. So a run with neither --target nor BENCHMARK_TARGET_DIR, the invocation acceptance criterion 15 and the README describe, died at assertSourceReady with ENOENT. The orchestrator found this independently before the review. Fixed in 79ab2e7: a relative target now resolves against the case directory, one base for the whole declaration, and the case declares ../../../nest/template. Verified: loadCase("audit-log").targetPath is /Users/joaofnds/code/nest/template and stat reports a directory. target.path still bypasses caseRelative, because a case may legitimately name a repository outside its own directory; a comment records why.

2. The new comparability rule refused legacy confirmation records. A group record written before this change carries no caseId, so the reader fills audit-log, while a comparison manifest's caseId is user-authored and falls back to case-1. The reviewer stripped caseId from six group records in a fixture and got "case case-1 arm baseline field caseId recorded audit-log; expected case-1". Every pre-change confirmation group would have become unreadable evidence in any manifest not named audit-log, defeating the legacy default added in this same change to keep old records readable. Latent, not observed in production data: .benchmark-runs holds only an empty comparisons directory. Fixed in c34cebd: a record that declared no case stays comparable, while a record carrying a different caseId is still refused with the error naming case, arm, and both ids. Both directions pinned.

SHOULD-FIX, all fixed and verified.

3. The caseId write path was unpinned. The reviewer deleted the four caseId lines in pipeline-confirmation.ts, then the one in confirmation-evidence.ts, then replaced the CLI wiring's value with the literal "WRONG": each time typecheck exited 0 and all 551 tests passed. The cause was object literals passed into a schema whose parameter is unknown, with .optional().default("audit-log") silently filling the field, and audit-log being the only declared case. This was exactly the mutation the card exists to prevent. Fixed in 831aa18 with typed record inputs so the compiler is the guard, plus a criterion-10 test driving a non-default case id. Verified by the orchestrator repeating the mutation: falsifying the case id at src/cli/run-command.ts:207 now fails a test that previously passed.

4. One unreadable directory under cases/ hid every valid case. Reproduced by the orchestrator: mkdir cases/zz-stray-probe then case list printed only the stray's error and exited 3, with audit-log absent. Fixed in f3c567c: the stray's reason goes to stderr, valid lines to stdout, exit 0. A silent skip was rejected because it hides a half-written case from its author. Verified: with a stray present, stdout carries only audit-log and the exit is 0.

5. case list crashed with a raw ENOENT at exit 1 when cases/ was absent, though a missing case directory is a refused precondition. Fixed in 3a31207: "No case directory at cases", exit 3.

6. bun test recreated an untracked pipelines/ directory at the control root, contradicting acceptance criterion 1. Worse at the paired site, an interrupted run would leave an untracked file inside the committed case directory, after which assertControlReady refuses every run. Fixed in 8e67abb using the existing TestResources helper. Verified: removed the directory, ran the full suite, it did not return.

7. The sourceDir empty guard had become unreachable for every branch except an empty BENCHMARK_TARGET_DIR, and its only end-to-end test had been correctly rewritten. Kept rather than deleted, because resolve("") is the working directory, so removing it would make an empty environment variable silently target the control repository. Pinned in 591a2c6.

NOTES, no action taken.

9. caseId is validated three ways for one concept: a strict lowercase regex in case.ts, a looser identity regex in confirmation-record.ts, and a bare min(1) in manifest.ts, with the loosest sitting on the record read back from disk. No reachable bad path was found; caseId is only ever written through parseCaseId.
11. case list without --json prints a tab-separated id and title, while the glossary says a command never prints a second summary-only shape and case show prints a path. Acceptance criterion 3 demanded the listing, so the criterion and the glossary conflict. Recorded as a decision to revisit, not an oversight.
12. Loading the case now precedes the TTY refusal, forced by criterion 15, so a refused run reads the case files first. All reads are read-only inside the control repository and no target is claimed; criterion 6 was re-verified by the orchestrator.
14. The criterion-13 loader test passes with the comparability rule deleted, so its title claims more than it checks. The rule itself is properly pinned by comparison-comparability.test.ts, so criterion 12 is honestly covered.
8. The review patch carried a .gitignore hunk absent from the repository, because João committed "chore: unignore backlog" mid-run between the shape commit and HEAD. The reviewer read the repository at HEAD, which is correct. No action.

Security: path traversal guards hold. The reviewer probed caseRelative with an absolute path, .. segments, empty strings, and a doubled-slash escape, and every one was refused; the --pipeline override is also refused outside the control repository. The one declared path that escapes the case directory is target.path, by design, since case declarations are committed rather than attacker-supplied.

Structural opportunity recorded, not taken: PipelineConfirmationRequest restates seven fields of BenchmarkCase, which is what let caseId drift from its case. Reshaping it touches about twenty read sites, out of scope for a directed fix.

Not observed live, carried forward: no run, replay, confirmation, or comparison ran against a live provider, so caseId on records from a real session rests on fake-backed tests. The declared target resolves to a real directory, but no run has executed against it.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Benchmark cases are data. cases/audit-log/case.json declares the task, product brief, final rubric, stage rubrics, pipeline, and target, parsed once by zod into a CaseDeclaration that refuses a mismatched id or a path outside its case directory. rehearsal case list and case show read declarations; --case selects one on run and replay, defaulting to audit-log. The run manifest, run artifact, and confirmation group and rep records carry caseId, with an absent field meaning audit-log so every record already on disk stays readable, and no schema version bumped. Comparability refuses an arm whose group ran a different case, while a group that declared no case stays comparable. Review found two blocking defects, both fixed: the declared target resolved to a nonexistent path, and the new comparability rule would have refused every legacy record in a manifest not named audit-log. Five should-fix defects fixed, including a caseId write path that three separate mutations could falsify with the whole suite green. Not observed live: no run against a provider, so caseId on real records rests on fake-backed tests.
<!-- SECTION:FINAL_SUMMARY:END -->
