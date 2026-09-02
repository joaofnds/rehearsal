---
id: ACT-26.4
title: declare benchmark cases as data and run any of them
status: Review
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 22:13'
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
<!-- SECTION:NOTES:END -->
