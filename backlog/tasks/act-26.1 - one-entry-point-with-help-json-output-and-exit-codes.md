---
id: ACT-26.1
title: 'one entry point with help, json output, and exit codes'
status: Review
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 21:18'
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
- [x] #1 `bun run rehearsal --help` exits 0 and lists run, replay, and compare with one description line each and the exit-code meanings
- [x] #2 `bun run rehearsal run --help` exits 0 and prints one line per flag naming the flag, its default, and its BENCHMARK_* environment variable, covering --target, --model, --effort, --judge-model, --judge-effort, --session-budget-usd, --pipeline, --confirm, --reps, --yes, --json
- [x] #3 `bun run rehearsal replay --help` and `bun run rehearsal compare --help` each exit 0 and print the same shape for their own flags
- [x] #4 Adding a flag to a command's declaration makes it appear in that command's --help without editing help text: a test asserts every declared flag name appears in the generated help
- [x] #5 `bun run rehearsal run --bogus` exits 2, prints nothing on stdout, and prints one stderr line naming --bogus
- [x] #6 `bun run rehearsal` with no command exits 2 and prints the top-level help on stderr
- [x] #7 `rehearsal compare <manifest> --json` writes the report and prints exactly the report JSON on stdout, which parseComparisonReport accepts and `jq` parses; without --json it prints only the report path
- [x] #8 `rehearsal compare <manifest>` with a valid manifest exits 0 and stdout contains no diagnostic text
- [x] #9 `rehearsal run` with stdin not a TTY exits 3 before any provider call, with a stderr line saying the review pause needs a TTY until ACT-26.3
- [x] #10 `rehearsal replay --run <name> --stage <stage> --confirm` without --yes and with stdin not a TTY exits 3, printing no projected cost, and does so before resolving the run directory
- [x] #11 `rehearsal compare <manifest> --json` writes nothing to stdout except the report JSON: `JSON.parse` of the whole stdout succeeds and equals the bytes of the report file the command wrote
- [x] #12 `rehearsal replay --run <name> --stage <stage> --confirm --yes` with stdin not a TTY prints no TTY-refusal message on stderr and fails instead on the named run, showing the TTY check does not fire when --yes answers it
- [x] #13 The existing config.test.ts parse tests pass unchanged: every flag name, environment fallback, default, and error message parseArgs and parseReplayArgs enforce today behaves identically under the new parser
- [x] #14 package.json has no benchmark, replay, or compare script and run-benchmark.ts, replay-stage.ts, and compare-confirmations.ts are gone; `bun run rehearsal <command>` is the only documented invocation
- [x] #15 README's Running and Comparing Confirmation Groups sections invoke `bun run rehearsal run`, `bun run rehearsal replay`, and `bun run rehearsal compare`, and state the exit-code meanings
- [x] #16 `rehearsal run --json` and `rehearsal replay --json` print the run artifact and the replay record respectively, parsed by the same schema that wrote them; a unit test over the command wiring asserts the printed bytes equal the record file's bytes
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

Decided during Build, on the same policy:

9. **`src/cli/` reaches the harness through the package's `#benchmark/*` subpath
   import, not a relative parent path.** Reason: oxlint's
   `import/no-relative-parent-imports` refuses `../benchmark/config` and names
   "convert to a package" as its sanctioned route; the subpath map is that route,
   it typechecks and resolves in Bun (observed), and it states the CLI-to-harness
   direction explicitly. `#cli/*` was added for symmetry so a CLI module's imports
   read the same wherever they point.
10. **Each error class lives in the module that raises it, and `exitCodeFor` reads
    the code off the error through an `in` narrowing.** Reason: `max-classes-per-file`
    and `import/prefer-default-export` together refuse both a two-error module and a
    one-class-per-file layout, and the anti-slop rules refuse sniffing an `unknown`.
    Placing each class with its raiser satisfies all three without a suppression and
    matches how `judge-execution-error.ts` already reads.
11. **A configuration rejection becomes a `UsageError` at the CLI boundary, not
    inside `config.ts`.** Reason: acceptance criterion 13 pins `config.ts` and its
    messages, and making the harness throw a CLI error type would point the harness
    at the CLI. `asUsageError` wraps the parse call where "the caller made a
    mistake" is known, so a missing required flag exits 2 as the exit-code table
    says, with `config.ts` untouched.
12. **A run that cannot be replayed is a refused precondition, exit 3, not an
    execution failure.** Reason: the glossary's Exit code entry, settled at Shape,
    lists "a run that cannot be replayed" under 3. The first implementation exited 1;
    the glossary is the record and wins.
13. **The readline prompt writes to stderr, not stdout.** Reason: "stdout carries
    data only" is the card's rule and a prompt is not data. It only appears on a
    terminal, where both streams reach the same screen.
14. **`run`'s terminal gate fires before the self-preference warning and before the
    pipeline loads.** Reason: the card says refuse before any work; a refused command
    that first printed a warning would be reporting on a session it will not run.

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
- Splitting each command module's harness wiring from its command policy — the
  refactor pass found it and it is filed as ACT-27, with the reverted attempt and
  the guard that refused it. Trigger: that card.
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
## Build handoff, 2026-09-02

### What changed

One executable, `rehearsal.ts` at the repository root, replaces
`run-benchmark.ts`, `replay-stage.ts`, and `compare-confirmations.ts`, which are
deleted along with their `bun run benchmark|replay|compare` scripts. `package.json`
gains a `rehearsal` script and a `bin` entry, so `bun run rehearsal <command>`
works without linking.

- `src/cli/commands.ts` declares the three commands and every flag as data: name,
  value or switch, environment variable, default, and one help line. Help text is
  generated from that table, so a flag cannot exist without its help line, and the
  same table is what rejects an unknown flag, by name.
- `src/cli/exit-codes.ts` names the four codes once; `UsageError` (in `commands.ts`)
  and `RefusedPreconditionError` (in `interactive-stdin.ts`) each carry their own,
  and `exitCodeFor` reads it, so no handler picks a number.
- `src/cli/{run,replay,compare}-command.ts` hold one command each: parse, gate,
  call the harness, report. `src/cli/output.ts` owns both stdout rules (the record's
  bytes under `--json`, its path otherwise) and the stderr diagnostic writer, so a
  change to what `--json` means is one edit, not four.
- `src/cli/interactive-stdin.ts` is the single terminal gate. `run` calls it
  unconditionally; `replay` calls it only for `--confirm` without `--yes`, before it
  resolves the run directory, so a refusal costs nothing and needs no recorded run.
- `src/benchmark/run.ts`'s `runBenchmark` returns the run's `BenchmarkRunPaths`
  instead of `void`, which is how `run --json` prints the artifact it wrote rather
  than recomputing the path.
- `src/benchmark/comparison-evidence-test-support.ts` holds the on-disk
  `ComparisonEvidenceFixture`, extracted unchanged from `comparison-loader.test.ts`
  in its own commit, because this machine has no recorded run to compare against.
- `config.ts` and `config.test.ts` are byte-identical to the pre-build baseline
  (`git diff d2c70aa..HEAD -- src/benchmark/config.ts src/benchmark/config.test.ts`
  is empty), so every flag name, environment fallback, default, and error message is
  unchanged. The CLI translates a configuration rejection into a `UsageError` at its
  own boundary rather than reaching into `config.ts`.

### What became possible but is not wired up

- The command table can carry a new command or flag with no parser or help edit; the
  entry point's dispatch is the one place a new command still needs a line.
- `--json` on `run` and `replay` is wired and unit tested against a written record,
  but has never printed a real run artifact or replay record, because both need a
  paid session. Only `compare --json` was observed end to end.

### Which callers are still on the old path

None. No file in the repository names the deleted scripts. The four subprocess tests
that spawned them now spawn `rehearsal.ts`.

### What I observed directly, and how

Every line below is a command run in this dispatch and its output. No paid provider
call was made; total spend for this dispatch is $0.00.

- `bun run rehearsal --help` printed the three commands with one summary line each
  and the four exit-code meanings; exit 0.
- `bun run rehearsal run --help`, `replay --help`, and `compare --help` each printed
  one line per declared flag with its default and `BENCHMARK_*` variable; exit 0.
  `run --help` covered all eleven flags the card names.
- `bun run rehearsal run --bogus` exited 2 with zero bytes on stdout and the single
  stderr line `Unknown flag --bogus for rehearsal run`.
- `bun run rehearsal` with no command exited 2, wrote nothing to stdout, and printed
  the top-level help on stderr.
- `bun run rehearsal compare <manifest> --json` exited 0 and printed only the report
  JSON on stdout: `jq -r '.schemaVersion, (.cases|length), .manifest.sha256'` parsed
  it (2, 2, and the manifest digest), and `cmp` reported the stdout bytes identical
  to `.benchmark-runs/comparisons/<sha>/report.json`. Without `--json` the same
  command printed only that path. The manifest came from the extracted fixture; the
  written report was removed afterward and `.benchmark-runs/comparisons/` is empty
  again.
- `echo | bun run rehearsal replay --run any-name --stage shape --confirm --model
  sonnet --session-budget-usd 1` exited 3, printed nothing on stdout, printed no
  projected cost, and printed no "No replayable run named", showing it refused
  before resolving the run directory.
- The same command with `--yes` exited 3 with `No replayable run named any-name;
  recorded runs: none` and no terminal-refusal message, showing the TTY check does
  not fire when `--yes` answers it.
- `echo | bun run rehearsal run --target /nonexistent --model sonnet
  --session-budget-usd 1` exited 3 before printing `Target:`, naming ACT-26.3.
- `bun run rehearsal run --model sonnet --session-budget-usd 1` exited 2 with
  `Provide --target or BENCHMARK_TARGET_DIR`.
- Full check, all after the last commit of code: `bun run typecheck`, `bun run lint`,
  and `bun run fmt:check` each exited 0; `bun test` reported 502 pass, 0 fail across
  43 files.

### What I did not verify

- No `run` or `replay` execution past its gate. Both need a paid session, and this
  machine has no recorded run to replay, so `run --json` and `replay --json` printing
  a real artifact is proven only by unit tests against a written record file, never
  by the harness itself.
- `runBenchmark` returning the run paths is exercised by no test that reaches its
  success path; the compiler and the CLI's injected-fake test are the only evidence.
- The `bin` entry is declared but was never installed or invoked as a linked
  `rehearsal` binary; every observation went through `bun run rehearsal`.
- Comparison of the printed help against a terminal narrower than the longest flag
  line: the lines are not wrapped.

### What stopped me, and where it went

Nothing blocked the work. One structural finding is filed rather than done:
**ACT-27**, splitting each command module's harness wiring from its command policy.
The split was attempted and reverted here because the extracted modules each export
one function, which `import/prefer-default-export` rejects, and pairing an arbitrary
second export to pass the guard would be worse than the duplication. The card carries
the case and two designs that would produce cohesive modules.

### Independent review

Due. The change replaces every entry point to the tool, deletes three files, alters a
public invocation surface documented in the README, and changes a harness signature
(`runBenchmark`). Two behaviors it introduces are refusals that stop work before it
starts, and one of them (`run` without a TTY) makes the tool unusable
non-interactively until ACT-26.3 lifts it; that trade deserves a second reader.
<!-- SECTION:NOTES:END -->
