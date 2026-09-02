---
id: ACT-26.1
title: 'one entry point with help, json output, and exit codes'
status: Build
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 20:56'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 22008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today three scripts (bun run benchmark, replay, compare) parse three flag dialects, print "Invalid argument sequence" for an unknown flag, and have no help. Replace them with one executable, rehearsal <command>, keeping every existing flag and environment fallback. Every command: --help that states each flag, default, and environment variable; --json that prints the strict record the command wrote (the same zod-validated artifact, never a second shape); stdout carries data only and stderr diagnostics; exit 0 when the command completed and its record was written, whatever the grade, non-zero for usage errors, refused preconditions, and execution failures. No prompt without a flag alternative; when stdin is not a TTY and the flag is absent, refuse before any paid work. The README's running section documents the new names.

Why: an agent reads help instead of docs, parses JSON instead of prose, and cannot answer a readline prompt. Gaps 4, 5, 6, and 7 in doc-1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `bun run rehearsal --help` exits 0 and lists run, replay, and compare with one description line each and the exit-code meanings
- [ ] #2 `bun run rehearsal run --help` exits 0 and prints one line per flag naming the flag, its default, and its BENCHMARK_* environment variable, covering --target, --model, --effort, --judge-model, --judge-effort, --session-budget-usd, --pipeline, --confirm, --reps, --yes, --json
- [ ] #3 `bun run rehearsal replay --help` and `bun run rehearsal compare --help` each exit 0 and print the same shape for their own flags
- [ ] #4 Adding a flag to a command's declaration makes it appear in that command's --help without editing help text: a test asserts every declared flag name appears in the generated help
- [ ] #5 `bun run rehearsal run --bogus` exits 2, prints nothing on stdout, and prints one stderr line naming --bogus
- [ ] #6 `bun run rehearsal` with no command exits 2 and prints the top-level help on stderr
- [ ] #7 `rehearsal compare <manifest> --json` writes the report and prints exactly the report JSON on stdout, which parseComparisonReport accepts and `jq` parses; without --json it prints only the report path
- [ ] #8 `rehearsal compare <manifest>` with a valid manifest exits 0 and stdout contains no diagnostic text
- [ ] #9 `rehearsal run` with stdin not a TTY exits 3 before any provider call, with a stderr line saying the review pause needs a TTY until ACT-26.3
- [ ] #10 `rehearsal replay --run <name> --stage <stage> --confirm` without --yes and with stdin not a TTY exits 3, printing no projected cost, and does so before resolving the run directory
- [ ] #11 `rehearsal compare <manifest> --json` writes nothing to stdout except the report JSON: `JSON.parse` of the whole stdout succeeds and equals the bytes of the report file the command wrote
- [ ] #12 `rehearsal replay --run <name> --stage <stage> --confirm --yes` with stdin not a TTY prints no TTY-refusal message on stderr and fails instead on the named run, showing the TTY check does not fire when --yes answers it
- [ ] #13 The existing config.test.ts parse tests pass unchanged: every flag name, environment fallback, default, and error message parseArgs and parseReplayArgs enforce today behaves identically under the new parser
- [ ] #14 package.json has no benchmark, replay, or compare script and run-benchmark.ts, replay-stage.ts, and compare-confirmations.ts are gone; `bun run rehearsal <command>` is the only documented invocation
- [ ] #15 README's Running and Comparing Confirmation Groups sections invoke `bun run rehearsal run`, `bun run rehearsal replay`, and `bun run rehearsal compare`, and state the exit-code meanings
- [ ] #16 `rehearsal run --json` and `rehearsal replay --json` print the run artifact and the replay record respectively, parsed by the same schema that wrote them; a unit test over the command wiring asserts the printed bytes equal the record file's bytes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Goal

One executable, `rehearsal <command>`, replaces the three scripts, so an agent
reads `--help` instead of the README, parses `--json` instead of prose, and never
meets a prompt it cannot answer with a flag.

## Unknowns, and how each was resolved from the repository

1. **Where the command modules live.** Resolved: `src/cli/`. The harness under
   `src/benchmark/` is the domain; the CLI is a delivery mechanism and points
   inward at it (doctrine §5, Dependency Rule). `src/benchmark/` keeps
   `benchmark-command.ts`, `replay-command.ts`, and `comparison-command.ts`,
   which are execution policy with no I/O of their own, not CLI wiring. No
   harness module moves.
2. **What `--json` prints for each command.** Read the code: `compare` already
   returns the report path from `writeComparisonReport` and the report is parsed
   by `parseComparisonReport`; `replay` already returns `{ record, recordPath }`
   from `runReplay`. `runBenchmark` (src/benchmark/run.ts:681) returns `void` and
   only logs `Run artifact: <path>`, so `run --json` needs it to return the
   artifact path. That is the one production change beyond wiring.
3. **Which prompts exist and where.** Three: the confirmation approval in
   `requireConfirmationApproval` (src/benchmark/confirmation.ts), which `--yes`
   already answers; the calibration pause loop in `collectCalibration`
   (src/benchmark/calibration.ts:264 and :360), which has no flag until
   ACT-26.3; and the failure pause in run.ts:940, which already degrades to an
   immediate restore when stdin is closed. So `run` is the command that must
   refuse without a TTY, and `replay` only when `--confirm` is present without
   `--yes`.
4. **Whether Bun passes arguments through `bun run <script>`.** Observed this
   session: `bun run ./tmp-argcheck.ts --foo bar --help` printed
   `["--foo","bar","--help"]`, and `process.stdin.isTTY` was `false` under
   redirected stdin. No `bun link` dependency.
5. **What the compare `--json` test can run against.** `.benchmark-runs/` on this
   machine holds only an empty `comparisons/` directory: there is no recorded run
   and no committed manifest fixture. The only comparison fixture is the private
   `ComparisonEvidenceFixture` class inside `src/benchmark/comparison-loader.test.ts`,
   which builds a manifest, groups, and reps in a temp directory. Build extracts
   it to a shared support module (the repository already has
   `comparison-test-fixtures.ts` and `test-support.ts` for this) and the CLI test
   uses it. Extraction is a behavior-preserving move committed separately from
   the CLI work (tidy first).
6. **Whether the dispatch's proposed replay observation works here.** It names run
   `2026-08-31T01-45-19.323Z`, which does not exist in `.benchmark-runs/`. That is
   why the TTY refusal is specified to fire *before* run-directory resolution:
   the refusal is then observable on any run name, and refusing before any work is
   the behavior the card asks for anyway ("refuse before any paid work").
7. **The existing subprocess tests that must keep working.** Three tests spawn the
   old entry points: `benchmark-command.test.ts` (two, on `run-benchmark.ts`),
   `replay-command.test.ts` (one, on `replay-stage.ts`), and
   `comparison-loader.test.ts:700` (on `compare-confirmations.ts`). All four move
   to `rehearsal.ts` with the same assertions; the two that pipe `"no\n"` into
   the approval prompt now assert the non-TTY refusal instead, because with
   `--confirm` and no `--yes` and no TTY the command refuses before projecting
   cost. That changes what those tests observe, and it is the behavior this card
   introduces.

## Decided autonomously

Nobody was available to answer during this dispatch; each of these follows the
dispatch's decision policy and can be reversed by João.

1. **Command modules live in `src/cli/`, not `src/benchmark/cli/`.** Reason: the
   CLI is a delivery detail depending on the harness, and a sibling directory
   states that direction of dependency where a nested one hides it (doctrine §5).
2. **Exit codes: 0 completed, 1 execution failure, 2 usage error, 3 refused
   precondition.** Reason: 2 for usage is the POSIX/BSD convention the language
   idiom follows (doctrine §12: idiom outranks book rule); 1 stays the generic
   failure an uncaught throw already produces, so an unconverted error path
   cannot silently masquerade as a usage error or a refusal.
3. **`run` without a TTY refuses at startup, unconditionally, until ACT-26.3.**
   Reason: the calibration pause has no flag alternative today (doc-1 gap 4), and
   the card's rule is refuse before any paid work. Refusing late, after a run has
   spent money, would be worse than refusing at all.
4. **The replay non-TTY refusal happens before run-directory resolution and
   before the cost projection.** Reason: a refused precondition should cost
   nothing, and it makes the behavior observable without a recorded run.
5. **No schema version bump and no new record field.** Reason: this card changes
   only how records reach stdout, never their shape (`--json` prints the same
   zod-validated bytes). Rule 4 of the decision policy is satisfied vacuously:
   every existing record stays parseable because none changes.
6. **`--json` is a flag on every command, declared in the same table as the rest,
   rather than a global pre-parsed switch.** Reason: one source of flag names
   (the command table) is the point of the table; a second, special-cased parse
   path would reintroduce the dialect problem the card exists to remove.
7. **`runBenchmark` returns the run artifact path.** Reason: the smallest change
   that lets `run --json` print the record it wrote; the alternative, having the
   CLI recompute the path from the timestamp, duplicates knowledge (DRY is about
   knowledge).
8. **The old `bun run benchmark|replay|compare` scripts are deleted, not
   aliased.** Reason: the card says one executable replaces them and the README
   documents the new names; a kept alias is a second dialect with no current
   caller (YAGNI). Trigger to add one back: a caller outside this repository
   turns out to invoke the old script names.

## Not built, and why

Each is named by ACT-26 or doc-1 but has no case in this card. The trigger that
would build it is its own card.

- `list`, `show`, `stale` — ACT-26.2. Trigger: that card.
- `review`, `calibrate`, `--pause` — ACT-26.3. Until then `run` refuses without a
  TTY rather than degrading the calibration pause.
- `case list|show|capture`, `--case` — ACT-26.4 and ACT-26.5.
- `--corpus` — ACT-26.6.
- Shell completion, a config file, colored output, `--quiet`/`--verbose` — no
  current case; agents read help and JSON. Trigger: a command whose output is too
  long for a terminal reader, or João asking.
- A generic option-parsing dependency — the flag surface is three commands and
  about a dozen flags, all `--flag value` or switches, and `config.ts` already
  parses them. Trigger: a command needing short flags, clustering, or `--`
  passthrough.

## Implementation plan

Ordered so each step is committable and the suite stays green.

1. **Extract the comparison fixture.** Move `ComparisonEvidenceFixture` out of
   `comparison-loader.test.ts` into a shared support module. Behavior-preserving,
   its own commit, no CLI code.
2. **The command table.** In `src/cli/commands.ts`, a `CommandDefinition`:
   name, one-line summary, positional argument (compare's manifest), and a list
   of `FlagDefinition` (`name`, `kind: "value" | "switch"`, `envVar?`,
   `default?`, `help`). Help text is generated from it. Tests first: help
   generation includes every declared flag; an unknown flag is a usage error
   naming the flag.
3. **Point the parser at the table.** `config.ts`'s `flagValues` learns the
   declared flag set so an unknown flag is rejected with the flag's name instead
   of "Invalid argument sequence near". `parseArgs` and `parseReplayArgs` keep
   their signatures, their environment fallbacks, and their error messages;
   `config.test.ts` is the pin and does not change.
4. **Error types at the boundary.** `UsageError` and `RefusedPreconditionError`
   in `src/cli/`, each mapping to its exit code in one place, so no handler picks
   a number. Everything else is an execution failure.
5. **The entry point.** `rehearsal.ts` at the repository root: shebang, Bun
   version check, dispatch on `Bun.argv[2]`, catch the error types, write
   diagnostics to stderr, exit with the mapped code. `bin` and a `rehearsal`
   script in package.json.
6. **One module per command** under `src/cli/`: `run-command.ts`,
   `replay-command.ts`, `compare-command.ts`, each holding the wiring lifted
   verbatim from the deleted script, with `log: console.log` replaced by a stderr
   writer and the record (or its path) written to stdout.
7. **The TTY gate.** A single `requireInteractiveStdin` check in the CLI layer,
   called by `run` unconditionally and by `replay`/`run` when `--confirm` is set
   without `--yes`, before any other work in the command.
8. **Delete the three scripts and their package scripts**, move the four
   subprocess tests onto `rehearsal.ts`.
9. **README and CLAUDE.md**: the Running and Comparing sections, the entry-point
   description, and the exit-code table. CLAUDE.md's "Entry points are
   run-benchmark.ts and replay-stage.ts" line becomes `rehearsal.ts`.

## First test to write

In `src/cli/commands.test.ts`, before any CLI code exists:

> `commandHelp` names every declared flag with its default and environment
> variable

Arrange a `CommandDefinition` with two flags, one with an environment fallback
and a default and one a switch; act by generating the help text; assert each
flag's name, default, and environment variable appears. It fails now because the
module does not exist, and it is the test that makes a flag without a help line
unrepresentable, which is the card's structural claim.

The second test is the subprocess one, `rehearsal run --bogus` exits 2 with the
flag named on stderr and nothing on stdout, which forces the entry point, the
error types, and the exit-code mapping into existence together.
<!-- SECTION:NOTES:END -->
