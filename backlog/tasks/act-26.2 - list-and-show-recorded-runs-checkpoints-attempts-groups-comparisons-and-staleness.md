---
id: ACT-26.2
title: >-
  list and show recorded runs, checkpoints, attempts, groups, comparisons, and
  staleness
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-03 02:39'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 23008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
To replay today, a session must read .benchmark-runs and parse timestamp names; to read a report it opens JSON under a SHA-named directory; nothing prints a confirmation or comparison report; the corpus-to-stage staleness ACT-4 computes is not queryable. Add rehearsal list <cases|runs|checkpoints|attempts|groups|comparisons> and rehearsal show <id>, where every ID printed is one the CLI accepts back as an argument. show prints the record with --json and a short markdown summary a session can paste onto a card: for a run, stages, grades, verdict, cost; for a group, the reliability summary (success rate, standard error, pass^k) and cost; for a comparison, the paired deltas beside the control arm. Add rehearsal stale [--corpus <source>], listing the checkpoints and cases an edit invalidated so a session knows what to re-run.

Why: jobs 4 and 5 in doc-1; the bespoke harnesses kept results in markdown because nothing gave them a citable, retrievable record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `bun run rehearsal list cases` exits 0 and prints one line per declared case as `case:<id>` followed by its title, including case:audit-log and case:smoke
- [x] #2 Every id `list` prints, for each of the six kinds, is accepted back by `show`: one test enumerates the ids a listing produced over a built fixture and asserts `show <id> --json` exits 0 for each
- [x] #3 `list runs` prints one line per recorded run as `run:<name>` with the case, the artifact's status, and whether the run is replayable (a manifest exists); a fixture with one manifested run and one pre-manifest run directory shows both lines, the second marked not replayable
- [x] #4 `list checkpoints` prints one line per checkpoint of every recorded run as `checkpoint:<run>/<stage>` with its stage and lineage
- [x] #5 `list groups` prints one line per confirmation group under .benchmark-runs/confirmations as `group:<group-id>` with its case, mode, and rep count
- [x] #6 `list comparisons` prints one line per comparison report under .benchmark-runs/comparisons as `comparison:<manifest-digest>` with its case count and rep count
- [x] #7 One unparseable record does not hide the valid ones: with a group directory holding invalid JSON beside two valid groups, `list groups` exits 0, prints the two valid lines on stdout, and prints one stderr line naming the unreadable id and the reason, following the `case list` precedent
- [x] #8 `list <kind>` over an empty or absent .benchmark-runs directory exits 0 and prints nothing on stdout
- [x] #9 `list bogus` exits 2 and names the accepted kinds on stderr, printing nothing on stdout
- [x] #10 `show run:<name> --json` exits 0 and prints exactly the bytes of the run's artifact.json on stdout, which JSON.parse accepts; the same holds for `show checkpoint:<run>/<stage>`, `show group:<id>`, `show comparison:<digest>`, `show case:<id>`, and both attempt forms, each printing the bytes of the one record file it names
- [x] #11 `show <id>` without --json prints a markdown summary on stdout and no JSON: for a run, one row per stage with its grade and verdict plus the final verdict and total cost; for a group, the reliability summary with success rate, standard error, and pass^k, and the group's cost; for a comparison, one row per contrast with the paired mean delta and standard error beside the control arm
- [x] #12 Each summary is a pure function from a parsed record to a string: three tests assert the markdown for a fixture record equals a committed expected string byte for byte, with no file read and no clock in the function
- [x] #13 `show` with no argument exits 2 naming the id forms; `show nonsense` exits 2 naming the unknown prefix; `show run:absent` exits 3 naming the record that does not exist, printing nothing on stdout
- [x] #14 A malformed id whose prefix is known but whose body is wrong (`show checkpoint:only-one-part`) exits 2 and names the form that prefix takes
- [x] #15 `show group:<id>` over a group record written without caseId exits 0 and its summary names the case as audit-log, showing the legacy default the parser already applies reaches the summary
- [x] #16 `bun run rehearsal stale` exits 0 and prints one line per stale checkpoint as `checkpoint:<run>/<stage>` followed by its causes, over a fixture whose recorded corpus digest for one stage no longer matches the corpus; a fresh checkpoint prints no line
- [x] #17 `stale` prints one line per stale session case as `case:<id>` naming each declared corpus file whose digest differs from the one its most recent attempt recorded; a case whose attempts all match the current corpus prints no line, and a case with no attempt prints no line
- [x] #18 `stale --corpus <directory>` reads that source through resolveCorpusSource instead of the live install: over one fixture, the same checkpoint is stale against a directory whose skill bytes differ and fresh against a directory holding the recorded bytes
- [x] #19 `stale --corpus <nonexistent>` exits 3 with the CorpusSourceError message on stderr and prints nothing on stdout
- [x] #20 `stale` starts no session and creates no worktree: it makes no provider call, adds no git worktree, and writes no file under .benchmark-runs; a test with a fake command runner asserts no command was run
- [x] #21 `list` and `show` are read-only: over a fixture .benchmark-runs, a directory listing and the digest of every file taken before and after every list kind and every show form are identical
- [x] #22 `bun run rehearsal --help` lists list, show, and stale with one summary line each, and `list --help`, `show --help`, and `stale --help` each exit 0 and print one line per declared flag with its default, generated from the same COMMANDS table
- [x] #23 `bun run rehearsal list attempts` run against the repository's own .benchmark-runs exits 0, prints one `attempt:session:<case-id>/<uuid>` line per attempt record with its case, outcome, and model for the eight records that exist, and names the three record-less attempt directories on stderr
- [x] #24 The suite runs offline and free: every test that needs a run, checkpoint, group, or comparison builds it in a temporary directory rather than reading the repository's .benchmark-runs, no test writes into the repository's .benchmark-runs, and no test invokes claude
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Goal

`rehearsal list <kind>`, `rehearsal show <id>`, and `rehearsal stale
[--corpus <source>]` make the records on disk discoverable and citable: every id
`list` prints is one `show` accepts back, `show` prints the strict record with
`--json` and a pasteable markdown summary without it, and `stale` names the
checkpoints and session cases an edit invalidated. All three are read-only and
make no provider call.

## What is actually on disk, against what the card assumed

The plan document (doc-1, gap 5) and the dispatch's own first framing said
`.benchmark-runs` holds legacy stage files, several `STAGE_JUDGE_FAILED`, review
templates, and pre-manifest runs that `list runs` must mark unreplayable. That is
false on this machine. Observed this dispatch with `find .benchmark-runs -maxdepth 3`:

- `comparisons/` — empty.
- `cases/smoke/` — the smoke case's transcript directory.
- `sessions/smoke/<uuid>/` — nine attempt directories written by ACT-26.5's and
  ACT-26.6's own runs. Eight hold `attempt.json`, `corpus/`, `transcript.jsonl`;
  one (`94eee86e-...`) is empty, from a run that failed before writing a record.
- `sessions/zz-symlink-probe/<uuid>/` — two attempt directories left by an
  ACT-26.6 probe, both empty.

There is **no** pipeline run, no `*.checkpoints/` directory, no `manifest.json`, no
`confirmations/`, no comparison report, and no legacy record of any kind. `.gitignore`
excludes `.benchmark-runs/`, so none of it is committed and none of it can be.

Consequences carried into this shape:

1. Only `list cases` and `list attempts` can be observed against real files.
   Every observation for `list runs`, `list checkpoints`, `list groups`,
   `list comparisons`, and `stale` builds its own fixture tree in a temporary
   directory. That is why every acceptance criterion for those kinds is worded
   "over a fixture" and why the runs directory must be a parameter, not a constant.
2. Legacy-record tolerance (a group or manifest written before `caseId` existed)
   is still worth carrying, because `parseConfirmationGroupRecord` and
   `loadRunManifest` already accept that shape and fill `LEGACY_CASE_ID`. It
   cannot be observed against a file on disk here; criterion 15 observes it
   against a fixture record written without the field, and Build must say so
   rather than claim it read a legacy record.
3. The session attempts under `.benchmark-runs/sessions/` are this run's
   evidence. Nothing in this card deletes or modifies them. `zz-symlink-probe`
   is leftover probe debris and is left alone; it is real input to
   `list attempts`.
4. Three of the eleven attempt directories hold no `attempt.json` at all
   (`find .benchmark-runs/sessions -maxdepth 2 -mindepth 2 -type d` returns 11,
   `find ... -name attempt.json` returns 8). That is a real, observable instance
   of the tolerance the card asks for: `list attempts` reading the repository's
   own directory must print the eight valid lines and report the three on
   stderr, not die. Criterion 23 is observable here without a fixture, and is
   the one place the record-tolerance behavior can be watched against files
   that already exist; criterion 7 observes the same tolerance for an
   unparseable group, which needs a fixture.

## Unknowns, and how each was resolved from the repository

Every resolution below cites a file read or a command run in this dispatch.

1. **What identity a session attempt actually has.** The dispatch's recommended
   `attempt:<lineage>/<timestamp>` does not fit. Read
   `src/cli/session-run-command.ts:183-190`: the record directory is
   `<runs>/sessions/<caseId>/<randomUUID()>`, and
   `sessionAttemptRecordSchema` (src/benchmark/session-record.ts:112) carries
   `caseId`, `lineage`, and `elapsedMs` but **no timestamp**. A session attempt's
   identity on disk is `<case-id>/<uuid>`. A stage replay's is different: read
   `run-layout.ts:81` — `replays/<lineage>/<timestamp>.json`. Resolved: `list
   attempts` covers both kinds the glossary's Attempt entry names, and the id
   carries which: `attempt:session:<case>/<uuid>` and
   `attempt:stage:<lineage>/<timestamp>`. Departure from the dispatch's
   recommendation, with the reason, per its own instruction to check first.
2. **Whether `stale` can derive checkpoint staleness without a worktree.** Read
   `replay.ts:309-339`: `currentChainCorpus` calls `captureStageCorpus(skill,
   instructions, roots)` with `skillSearchRoots(worktreeDir)`, which is why
   replay needs a worktree. But `captureStageCorpus` (checkpoint.ts:138) only
   hashes: it takes the instructions text and a list of roots and reads nothing
   else. Resolved: `stale` passes the corpus source's roots directly and needs
   no worktree, no git, and no session. The manifest carries the whole pipeline
   (`manifest.ts:47`), so the stage-to-skill map that `currentChainCorpus`
   reconstructs is available from the manifest alone.
3. **Whether `--corpus` on `stale` contradicts ACT-26.6's stage-corpus refusal.**
   Read `interactive-stdin.ts:refuseStageCorpus` and `session-corpus.ts:
   stageCorpusRefusal`: the refusal is about *delivering* a corpus variant to a
   running stage, because a project-level skill does not shadow a user-level one
   (ACT-28). `stale` delivers nothing; it hashes. ACT-26.6's own record settles
   this in its "Not built" list: "`--corpus` on `stale`. ACT-26.2 owns that
   command and reads the same resolver; this card makes the resolver its own
   module so that it can." Resolved: `stale --corpus` resolves through
   `resolveCorpusSource` and must not call `refuseStageCorpus`.
4. **What makes a *case* stale, as against a checkpoint.** A pipeline case has no
   record of its own; its staleness is its checkpoints', already covered.
   A session case does: read `session-record.ts:120` — each attempt records
   `corpusFiles` as `{path, resolvedPath, sha256}`. Resolved: a session case is
   stale when its most recent attempt's recorded digests differ from
   `hashCorpusFiles(source, declaration.corpusFiles)` today. A case with no
   attempt is not stale, because nothing was invalidated; that is now in the
   glossary as **Stale case**.
5. **Whether the run artifact can be parsed back for `show run:`.** Read
   `contracts.ts:308-361` and ACT-26.4's note 2: `RunArtifact` is a TypeScript
   interface with **no zod schema**, written by `buildRunArtifact` and parsed by
   nothing. Resolved: `show run:<name> --json` prints the artifact file's bytes
   verbatim (the `writeRecord` route `output.ts` already owns), and the markdown
   summary parses only the handful of fields it renders through a narrow zod
   schema of its own — a summary schema, not a second record shape. That keeps
   `--json` honest (the record's own bytes) without inventing a full artifact
   schema this card does not need.
6. **The precedent for not dying on one bad record.** Read `case.ts:223-239`:
   `listCases` collects `{id, reason}` into `unreadable` for any
   `CaseDeclarationError` and rethrows anything else; `case-command.ts:runCaseList`
   prints each reason to stderr and the valid lines to stdout, exit 0. Resolved:
   every listing returns the same `{ entries, unreadable }` pair and the command
   layer prints it the same way. One shape, six kinds.
7. **Where run and group enumeration lives.** Grepped: `run-layout.ts` is the only
   module that knows `confirmations/`, `comparisons/`, and `<name>.checkpoints`,
   and `runNameFromCheckpointsEntry` already exists there for exactly this
   parse. `resolveRunDirectory` (replay-command.ts:253-274) already enumerates
   recorded runs by mapping that function over `readdir`. Resolved: the
   enumeration counterpart lives beside the path builders in `run-layout.ts`,
   and `resolveRunDirectory`'s ad-hoc listing is replaced by it, removing the
   duplication as a side effect rather than as separate work.
8. **Whether the summaries have an existing byte-for-byte precedent.** Grepped
   `comparison-report.ts` for markdown: there is none. The comparison report is
   JSON only; the one snapshot file is `comparison-loader.test.ts.snap`.
   Resolved: the summaries are the first markdown in the repository. They are
   pure `(record) => string` with no I/O and no clock, asserted against a
   committed expected string, which is what makes "byte for byte" meaningful.
9. **Which fixture builders exist.** `comparison-evidence-test-support.ts`
   (`ComparisonEvidenceFixture`, extracted by ACT-26.1 for this exact reason)
   writes manifests, groups, and reps, but under `<root>/groups/<case>-<role>/`,
   **not** the `confirmations/<groupId>/` layout `list groups` reads. Read
   `comparison-test-fixtures.ts` (`comparisonRep`, `comparisonReps`, `PASS`,
   `FAIL`) — in-memory record builders, no disk. Resolved: reuse
   `comparisonRep`/`comparisonReps` for record values and add one on-disk
   builder that writes them at the real `run-layout.ts` paths, so the listing is
   tested against the layout the harness actually writes. Extending
   `ComparisonEvidenceFixture` to two layouts would make it serve two masters.
10. **How a two-token command reaches the table.** Read `commands.ts:120-205`
    and `findCommand`: `case list`, `case show`, and `case capture` are already
    two-token names and the longest declared name wins. `list` takes its kind as
    the positional `argument`, not as a second name token, because the kinds are
    data over one uniform listing rather than six commands. Resolved: three new
    entries (`list`, `show`, `stale`), each with its positional and `--json`,
    and `stale` also with `--corpus`.
11. **Whether adding commands to the table alone is enough.** ACT-26.1's review
    note 5 recorded exactly this: "Adding a command to COMMANDS without a
    dispatch case fails only at runtime; typecheck, lint, and the suite all pass.
    ACT-26.2 adds three commands to that table." Resolved: this card adds a test
    that every entry in `COMMANDS` dispatches, so the gap that note predicted is
    closed by the card that would have fallen into it. ACT-27 still owns the
    structural split.

## Decided autonomously

Nobody was available to answer during this dispatch. Each of these follows the
dispatch's decision policy and can be reversed by João.

1. **`attempt:` carries the attempt kind: `attempt:session:<case>/<uuid>` and
   `attempt:stage:<lineage>/<timestamp>`.** Departure from the dispatch's
   recommended `attempt:<lineage>/<timestamp>`, which the dispatch itself
   invited by saying to check the real identity first. Reason: the two attempt
   kinds have genuinely different identities on disk (unknown 1), both are
   two-segment, and telling them apart by whether the first segment looks like a
   64-hex sha would be a shape sniff rather than a parse. The kind in the id is
   what lets `show` parse a prefix into one shape instead of guessing (§5,
   parse-don't-validate).
2. **`list` takes its kind as a positional argument, not as six command names.**
   Reason: the six listings differ only in which records they read and how one
   line renders; the command's flags, output rules, and failure modes are
   identical. Six table entries would repeat that once each (YAGNI, §12).
   Trigger to split: a kind that needs a flag the others do not.
3. **`stale` reports checkpoints and session cases, and nothing else.** Reason:
   the card's sentence is "the checkpoints and cases an edit invalidated". A
   pipeline case's staleness *is* its checkpoints', so listing it again would
   report the same fact twice under two ids (policy rule 5).
4. **A case with no recorded attempt is not stale.** Reason: staleness is a claim
   that a prior measurement no longer describes the corpus. With no measurement
   there is nothing to invalidate, and printing every never-run case would make
   `stale`'s output useless on the first day. Recorded in the glossary so a later
   session reads it as settled rather than as an omission.
5. **`show --json` prints the record file's bytes; the markdown summary parses
   only the fields it renders.** Reason: ACT-26.1 settled that `--json` prints
   "the same zod-validated artifact, never a second shape", and the run artifact
   has no schema at all (unknown 5). Writing a full `RunArtifact` schema to
   render four numbers would be a large speculative surface; a narrow summary
   schema parses exactly what it prints and fails loudly on a record that cannot
   supply it (§5). Trigger for a full artifact schema: a command that must
   validate a run artifact rather than render it.
6. **A record that parses but cannot be replayed is listed with that status, not
   omitted and not an error.** Reason: the card's own words, and it is the whole
   point of `list runs` for a session deciding what to re-run. `run:<name>` is
   marked not replayable when `manifest.json` is absent, which is the same
   condition `resolveRunDirectory` already refuses on.
7. **The runs directory is a parameter of every listing and of `stale`, not
   `benchmarkRunsDirectory(CONTROL_DIR)` read inside them.** Reason: nothing on
   this machine can exercise five of the six kinds otherwise (the disk finding
   above), and the CLI layer already owns that constant for every other command
   (`rehearsal.ts` passes it to `runCompare`). Determinism and a temp-directory
   fixture are what make the suite free and offline.
8. **`list bogus` and a malformed id are usage errors (2); a well-formed id
   naming an absent record is a refused precondition (3).** Reason: it is the
   distinction `case-command.ts` already draws — `case show missing` exits 3
   (ACT-26.4 criterion 5) while an unknown flag exits 2 — and the glossary's
   Exit code entry. Consistency across the CLI beats a fresh judgment here.
9. **`stale` does not call `refuseStageCorpus`.** Reason: unknown 3. The refusal
   exists because a skill variant cannot be *delivered* to a stage; `stale`
   delivers nothing. ACT-26.6's record already assigns `--corpus` on `stale` to
   this card.
10. **No schema version bump and no new record field.** Reason: this card only
    reads. Policy rule 4 (records readable in both directions) is satisfied
    vacuously because no record changes.

## Not built, and why

Each is named by the card, doc-1, or the surface sketch but has no case here.

- **Filtering flags beyond the kind, and pagination.** Named "Not built" in the
  dispatch. Nine attempts and zero runs on disk; `list ... | grep` is the idiom.
  Trigger: a listing whose output a session cannot read in one screen, or João
  asking.
- **`show <run> --checkout <dir>`**, materializing the candidate for inspection.
  doc-1 names it under the `run --pause` decision, not this card. Trigger: its
  own card, or ACT-26.3.
- **A comparison manifest generated from group IDs.** doc-1 decides the CLI will
  generate them; that is `compare`'s surface, not `list`/`show`'s. Trigger: a
  card for it.
- **A full zod schema for `RunArtifact`.** Decision 5. Trigger: a command that
  must validate a run artifact rather than render one.
- **Staleness for a pipeline *case* as an id of its own.** Decision 3. Trigger:
  a pipeline case that carries corpus files outside its stages' skills.
- **Marking a session attempt stale.** `stale` reports the *case*, which is what
  a session re-runs; an attempt is a past event and does not become re-runnable.
  Trigger: a listing that must show which specific attempts a comparison would
  refuse.
- **Deleting or garbage-collecting records.** Nothing in the card; `list` and
  `show` are read-only by criterion 21. Trigger: `.benchmark-runs` growing past
  what the disk holds.

## Implementation plan

Ordered so each step is committable, the suite stays green, and the fixture
exists before anything that needs it.

1. **Enumeration in `run-layout.ts`.** `recordedRunNames(runsDirectory)`,
   `confirmationGroupIds(runsDirectory)`, `comparisonDigests(runsDirectory)`,
   `sessionAttemptIds(runsDirectory)`, `replayAttemptIds(runsDirectory)`, each a
   `readdir` filtered by the shape that module already builds, each returning
   `[]` for an absent directory. Point `resolveRunDirectory` at
   `recordedRunNames` and delete its inline listing. Behavior-preserving for
   replay; its own commit.
2. **The on-disk fixture builder**, `src/benchmark/run-records-test-support.ts`:
   writes a manifest, checkpoints, a run artifact, a confirmation group with its
   reps, a comparison report, and a session attempt at the real `run-layout.ts`
   paths under a caller-supplied root, composing `comparisonRep` and
   `comparisonReps` from `comparison-test-fixtures.ts` for the record values. It
   is the prerequisite for every observation in this card and is written first,
   with a test of its own asserting each written file parses with the schema
   that reads it.
3. **`src/cli/record-id.ts`**: the `RecordId` discriminated union and
   `parseRecordId(text)`, which splits on the first `:`, matches the prefix, and
   parses the remainder into that prefix's shape or throws `UsageError`. Its
   inverse, `formatRecordId(id)`, is what `list` prints, so the two cannot drift.
   A round-trip test over one id of each kind is the guard.
4. **`src/cli/list-command.ts`**: one `listRecords(kind, runsDirectory)`
   returning `{ entries: { id, line }[], unreadable: { id, reason }[] }`, and a
   command function that prints entries to stdout, reasons to stderr, exit 0 —
   the `runCaseList` shape. `cases` delegates to the existing `listCases`.
5. **`src/benchmark/record-summary.ts`**: `runSummary`, `groupSummary`,
   `comparisonSummary`, each `(record) => string`, pure, no I/O. In
   `src/benchmark/` and not `src/cli/` because rendering a record is knowledge
   about the domain's records, and the CLI points inward at it (§5). Tested
   against committed expected strings.
6. **`src/cli/show-command.ts`**: parse the id, resolve it to its one record
   file, print bytes under `--json` (through `writeRecord`, which already owns
   that rule) or the summary otherwise. An absent file is a
   `RefusedPreconditionError`.
7. **`src/benchmark/staleness-report.ts`**: `staleCheckpoints(runsDirectory,
   corpusRoots, instructions, knobs)` walking each run's manifest and
   checkpoints through the existing `deriveStaleness`, and
   `staleCases(runsDirectory, source)` comparing each session case's declared
   corpus digests against its most recent attempt's. Then
   `src/cli/stale-command.ts` wiring `resolveCorpusSource` to both.
8. **The table and the dispatch**: three entries in `COMMANDS`, three cases in
   `rehearsal.ts`, plus the test that every declared command dispatches
   (unknown 11).
9. **README**: a Reading the records section covering the three commands, the id
   forms, and the exit codes.

## First test to write

In `src/cli/record-id.test.ts`, before any of the modules above exist:

> `parseRecordId` reads `checkpoint:2026-09-03T00-00-00.000Z/build` as a
> checkpoint id naming that run and that stage

Arrange the string; act by parsing; assert the returned value's `kind` is
`"checkpoint"`, its `run` is the timestamped name, and its `stage` is `build`.
It fails now because the module does not exist. It is the right first test
because the id is the contract the whole card turns on — `list` formats it,
`show` parses it, and "every ID printed is one the CLI accepts back" is the
card's one structural claim — and because a checkpoint id is the form that
carries two segments, so it forces the union, the split, and the failure path
into existence at once.

The second test is the round trip: `formatRecordId(parseRecordId(x)) === x` over
one id of each of the seven forms, which is what makes the accepts-back property
a property rather than seven separate assertions.

## Verification

Run in this dispatch, after the glossary edit and before the commit:
`bun run typecheck`, `bun run lint`, and `bun run fmt:check` each exited 0;
`bun test` reported 779 pass, 0 fail across 56 files. `bun run rehearsal case
show missing` exited 3 with an empty stdout, confirming the exit-code precedent
decision 8 leans on. No paid provider call was made; spend $0.00.

## Build handoff

Thirteen commits, `bb8c0e4` through `d9d08be`. All 24 acceptance criteria are
checked; every one has either a test in this dispatch or a CLI run recorded
below. `bun run typecheck`, `bun run lint`, and `bun run fmt:check` each exited
0; `bun test` reported 894 pass, 0 fail across 63 files. `git status` is clean.
No provider call was made; spend $0.00.

### What changed

- `src/cli/record-id.ts` — the `RecordId` discriminated union, `parseRecordId`,
  and its inverse `formatRecordId`. Seven forms, including both attempt kinds.
- `src/benchmark/run-layout.ts` — `recordedRunNames`, `confirmationGroupIds`,
  `comparisonDigests`, `sessionAttemptIds`, `replayAttemptIds`, plus
  `replayRecordFile`, `sessionAttemptPaths`, and `checkpointRecordFile`.
  `resolveRunDirectory` dropped its own copy of the run listing.
- `src/benchmark/record-summary.ts` — `runSummary`, `groupSummary`,
  `comparisonSummary`, pure, with the narrow schemas the run artifact and the
  group's `report.json` are parsed through.
- `src/cli/list-command.ts`, `src/cli/show-command.ts`,
  `src/benchmark/staleness-report.ts`, `src/cli/stale-command.ts` — the three
  commands and the staleness derivation behind `stale`.
- `src/benchmark/run-records-test-support.ts` — `RecordedRunsFixture`, writing
  a manifest, checkpoints, two run artifacts, a group with its report, a real
  comparison report, and both attempt kinds at the real `run-layout` paths.
- Three entries in `COMMANDS`, three dispatch cases in `rehearsal.ts`, a
  README "Reading the Records" section, and the glossary's Command and
  Command record entries.

### What I observed directly, and the command that showed it

Every line below is a CLI run in this dispatch, not a test result.

- `bun run rehearsal list attempts` — eight `attempt:session:smoke/<uuid>`
  lines on stdout with case, outcome, and model; the three record-less
  directories (`smoke/94eee86e…` and both `zz-symlink-probe` entries) named on
  stderr with their ENOENT reason; exit 0. This is criterion 23 against the
  repository's own `.benchmark-runs`, and the one place the
  does-not-die-on-a-bad-record behavior is observable against files that
  already existed.
- `bun run rehearsal show attempt:session:smoke/fa239c6c-… --json` — printed
  that record's own bytes, an id `list` had just printed. `show case:smoke
  --json` likewise.
- `bun run rehearsal stale` — printed `case:smoke  output-styles/brief.md
  changed`, exit 0, against this machine's live corpus. I checked this against
  the files: the most recent attempt by mtime (`7df02690…`, 1788395926)
  recorded `600426af…` while `~/.claude/output-styles/brief.md` now hashes
  `9f1ffb5e…`. Real staleness, not a fixture.
- `bun run rehearsal list runs|checkpoints|groups|comparisons` — each exit 0
  with empty stdout, because none of those has ever been recorded here
  (criterion 8).
- Exit codes: `list bogus` 2, `show nonsense` 2, `show
  checkpoint:only-one-part` 2, `show run:absent` 3, `stale --corpus /nope` 3.
- `rehearsal --help`, `list --help`, `show --help`, `stale --help` — all exit
  0, all generated from `COMMANDS`.
- The suite leaves `.benchmark-runs` byte-for-byte identical: I hashed every
  file under it before and after `bun test`, and the digests match. All 138
  entries remain.

### What I did not verify

- **Legacy-record tolerance against a legacy file.** No record written before
  `caseId` existed exists on this machine. Criterion 15 is observed against a
  fixture group written without the field (`writeGroupWithoutCaseId`), where
  the parser's `LEGACY_CASE_ID` default reaches the summary. That is a real
  observation of the code path, and it is not an observation of a legacy file.
- **`show` and `list` over a real pipeline run, checkpoint, group, or
  comparison.** None exists here. Every such observation is against
  `RecordedRunsFixture`, which writes at the real `run-layout` paths — so it
  exercises the layout the harness writes, but the records themselves are
  built, not produced by a run.
- **`attempt:stage:` against a real replay record.** No replay has been
  recorded here either; the stage-attempt path is covered by fixture only.
- **`--corpus chezmoi:<ref>`.** `stale` reaches `resolveCorpusSource`, which
  ACT-26.6 already covers for the chezmoi branch; I exercised only the
  directory and live branches, and the absent-directory refusal.

### Decided autonomously

Nobody was available during this dispatch. The Shape record's ten decisions
stood; these are the ones Build had to add, each reversible by João.

1. **`list attempts` lists both attempt kinds, not only session attempts.**
   The glossary's Attempt entry names both, the id union carries both, and a
   session choosing what to re-run wants every prior measurement. The kind in
   the id is what keeps them apart. Cost: one extra `readReplayRecord` call
   per replay.
2. **"Most recent attempt" for a session case's staleness is decided by the
   record file's mtime.** The attempt record carries no timestamp (Shape's
   unknown 1 established this) and a uuid gives no order, so mtime is the only
   ordering on disk. It is filesystem state rather than record state, which is
   the weakness; the alternative — treating a case as fresh when *any* attempt
   matches — reads criterion 17's "most recent" out of the card. Trigger to
   revisit: adding a timestamp to the session attempt record, which would make
   this deterministic from the record alone.
3. **A declared corpus file the source no longer holds is a staleness cause,
   not a thrown error.** `hashCorpusFiles` throws `CorpusFileError` for a
   missing file, which would have made one case's missing style hide every
   other case's answer. It invalidates the measurement as surely as an edit
   does — the case cannot run against that corpus at all — so it is reported
   as a cause. This follows the card's own does-not-die-on-a-bad-record rule.
   Found by a test, not by reading.
4. **`list` declares no flags.** The six kinds differ only in what they read;
   `--json` on a listing is not in the card and nothing needs it today
   (`list … | grep` is the idiom, per the card's own "not built"). Trigger: a
   caller that must parse a listing rather than read it.
5. **A record kind with no summary prints its own bytes without `--json`.**
   The card names summaries for run, group, and comparison only. A case
   declaration or a checkpoint has no summary that would show more than the
   record, so inventing one would render less than what it replaced.
6. **The group summary reads the group's `report.json` beside its
   `group.json`.** Criterion 10 says `--json` prints the record file the id
   names (`group.json`), and criterion 11 wants success rate, standard error,
   pass^k, and cost, which live only in the report the group writes beside it.
   Both are satisfied by reading two files for the summary and one for `--json`.
7. **`staleCheckpoints` skips a run whose manifest is absent rather than
   failing.** A run with no manifest was never replayable, so nothing about it
   can go stale; failing the whole report over it would hide every other run's
   answer.

### Defects met on the way, fixed in their own commits

- `d9d08be` — **a path traversal in `show`.** I probed it before handing the
  question to a reviewer, and it was real:
  `rehearsal show 'group:../../../../../../etc/passwd'` resolved to
  `/etc/passwd/group.json`, and `run:<traversal>` reached any `*.json` on the
  filesystem. Every id segment was interpolated into a path with nothing
  checking where it landed. Fixed in the parser rather than in the seven path
  builders: a segment that is `.`, `..`, or contains `/` is refused, so no
  caller can hold an id that escapes. Every real segment is one path
  component, so nothing legitimate is refused — re-verified after the fix that
  `list attempts` still prints eight lines, `show` still prints both records,
  and `stale` still reports `case:smoke`. Nine new tests cover the refusal.
- `8c7efff` — `list` is the first flagless command, and the help printed a
  `Flags:` heading with nothing under it plus a `[flags]` usage suffix that
  accepts nothing. An agent reads the help instead of the docs, so this is a
  wrong answer rather than a cosmetic one.
- `99eb29e` — the shared `--json` help said "the record this command wrote",
  which is false for `show`, the first command that prints a record it did not
  write.

### The refactor pass

`5c416a5`. Reading the records exposed that five modules — including
`session-run-command.ts`, which *writes* the record — each spelled out
`sessions/<case>/<uuid>/attempt.json` and `checkpoint.json` as their own
`join` of string literals. A layout change would have moved the writer and
left every reader on the old shape, silently, because nothing types a join of
four strings. `sessionAttemptPaths` and `checkpointRecordFile` now live in
`run-layout.ts` beside the paths that module already owned, and every caller
goes through them. Tests green before and after; the CLI re-observed after.

Also folded in as it arose, not as separate work: `resolveRunDirectory` lost
its inline run listing to `recordedRunNames` (`4f12bed`), and
`benchmarkRunPaths.replayRecordFile` now delegates to the standalone
`replayRecordFile` so a replay record is reachable without naming a run.

### What became possible but is not wired up

- **`list` and `show` accept any runs directory**, but `rehearsal.ts` always
  passes `benchmarkRunsDirectory(CONTROL_DIR)`. There is no flag to point them
  elsewhere; the parameter exists so the suite can build fixtures. If a
  `--runs` flag is ever wanted, the plumbing is already there.
- **`replayAttemptIds` and the `attempt:stage:` id** work end to end but have
  never met a real replay record, because none has been recorded here.
- **`recordIdForms()`** is exported and used only by `show`'s usage message.
  A future `rehearsal show --help` could print the table; today the README
  carries it.

### Still on the old path

Nothing. No existing caller changed behavior: `resolveRunDirectory` and
`runSessionDebugAttempt` were pointed at the new helpers with their behavior
preserved, and their existing tests pass unchanged.

### Independent review is due

The `review` skill's triggers apply: the change is outward-facing (a CLI that
agents and João run, whose help text and exit codes are its contract) and it
parses untrusted input at two boundaries (a record id from the command line,
and every record read off disk). Worth a reviewer's attention in particular:

- **Decision 2**, mtime as the recency signal for a session case's staleness.
  It is the weakest thing in this change: filesystem state standing in for
  record state, because the record carries no timestamp.
- **The traversal fix in `d9d08be`.** I found and fixed one escape; a second
  reader should check the refusal is complete. It refuses `.`, `..`, and any
  `/` in a segment. Not refused, and I judged them harmless because they are
  path components that stay under the root: a leading `-`, a NUL-free control
  character, a very long segment, a Windows `\` separator (this harness is
  macOS-only and `join` does not treat `\` as a separator there). A reviewer
  who disagrees about `\` should say so.
- **`show`'s exit-3 message names the resolved absolute path** (`No record
  run:x at /Users/.../x.json`). That is useful to an agent and it discloses
  the control repository's location on stderr. I left it because every other
  command in this CLI already prints absolute record paths on stdout.

## Review fixes (directed dispatch)

Ten findings fixed, each in its own commit, plus one refactor commit. Every
verification below is a tool result from this dispatch. No paid provider call
was made; spend $0.00.

`bun run typecheck`, `bun run lint`, and `bun run fmt:check` each exited 0;
`bun test` reported 931 pass, 0 fail across 63 files and exited 0.

### Fresh-clone suite

The reason finding 3 existed. Cloned this repository to `/tmp/rehearsal-final`
at `721601b`, `bun install --frozen-lockfile`, then `bun test` twice:

- Second run: 930 pass, 1 fail. The one failure is `loadCase > resolves the
  declared target to a directory that exists`, ACT-26.4's, which depends on a
  repository outside this one. **Pre-existing clone failure, not from this
  card.**
- First run additionally failed four tests, all one cause: `rehearsal compare`
  exits 1 with a raw ENOENT when `.benchmark-runs` does not exist. Reproduced
  at `3798639`, the Shape commit before any of this card's code, so it predates
  this card. Filed as **ACT-30**.

Before the fix, the same clone failed 8: those four plus the three this card
owned plus ACT-26.4's.

### The commits

1. `d864e52` — **finding 1**, `stale` died on one unreadable attempt record.
   `staleCases` now returns `{ records, unreadable }` and `runStale` prints the
   unreadable on stderr, exit 0. Observed: over a copy of this repository's
   runs directory with one `{ not json` attempt record added, the old code
   exited 1 printing nothing on stdout; the new code printed
   `attempt:session:smoke/broken-0000-0000: JSON Parse error: Expected '}'` on
   stderr, `case:smoke output-styles/brief.md changed` on stdout, exit 0.
   **Mutation that proves the test:** removing the `try`/`catch` around
   `parseSessionAttemptRecord` fails both new tests (the module-level one and
   the command-level one).
2. `0e0d7cf` — **finding 2**, `stale` could never report model or effort
   staleness. It compared each checkpoint against the manifest that produced
   it. `stale` now reads `--model` and `--effort` through `parseStaleArgs`,
   beside `parseReplayArgs`, with the same `BENCHMARK_MODEL` and
   `BENCHMARK_EFFORT` fallbacks. Unlike run and replay it requires neither: a
   knob it was not given asserts nothing. Observed: over a fixture recorded at
   sonnet, `BENCHMARK_MODEL=opus` printed
   `checkpoint:.../discuss model sonnet is now opus` and the same for build;
   `--effort high` printed `effort none is now high`; with no knobs neither
   half fired. **Mutation:** reverting to `manifest.model`/`manifest.effort`
   fails all three new tests.
3. `db0e90c` — **finding 3**, three tests asserted exact counts against
   `.benchmark-runs`. The record-less attempt directory is now a fixture
   (`writeEmptyAttemptDirectory`) beside the unreadable group that already
   covered the same tolerance, and the two end-to-end CLI tests read `cases/`,
   the one listing a fresh checkout can answer. **Mutation:** removing the
   `collect` tolerance fails both the group test and the new attempt test.
   Criterion 23's observation is recorded below rather than asserted forever.
4. `10436b7` — **finding 4**, `stale --corpus <dir>` crashed on a valid corpus
   with no CLAUDE.md. The read is now per-run, once a manifest says a
   checkpoint exists, and a corpus that cannot supply the file fails as
   `CorpusFileError`, which the command translates to exit 3. Observed:
   `rehearsal stale --corpus /tmp/styles-corpus` (holding only
   `output-styles/brief.md`) exited 1 with a raw ENOENT before, and exits 0
   printing `case:smoke output-styles/brief.md changed` after.
5. `e6115ae` — **finding 5**, `stale --corpus chezmoi:<ref>` leaked two temp
   directories per invocation. `discardRender` moved to `corpus-source.ts`,
   beside the render that creates both directories, and `runStale` discards in
   a `finally`. Observed with a real chezmoi render: 26 `rehearsal-chezmoi-*`
   directories before and 26 after with the fix, 26 before and 28 after
   without it. The README's "none of them writes anything" now names the
   exception.
6. `d135bf9` — **finding 6**, `stale` discarded `listing.unreadable` from
   `listCases`. Observed: with a stray `cases/zz-observe-probe/` directory,
   `rehearsal stale` printed
   `case:zz-observe-probe: Unknown case zz-observe-probe: no declaration at
   cases/zz-observe-probe/case.json` on stderr and `case:smoke ...` on stdout,
   exit 0. The probe directory was removed after.
7. `f122d90` — **finding 7**, `stale`'s skill roots diverged from replay's.
   `corpusSkillRoots(source)` in `checkpoint.ts` is now the one spelling: the
   live install is `skillSearchRoots(CONTROL_DIR)`, and a resolved directory or
   render is its own root alone. Observed: `stale`'s live roots and
   `skillSearchRoots(CONTROL_DIR)` print the identical two-element array.
8. `394f642` — **finding 8**, the live-corpus branch was untested.
   `recordCorpusFrom` now takes a corpus root rather than a directory path, so
   a fixture records through the same resolver `stale` reads by. What the
   branch asserts stays independent of which skills a machine has installed,
   which is why the clone is green.
9. `0663073` — **finding 9**, "most recent attempt" by mtime was untested.
   `writeAttemptAt` puts two attempts for one case on disk under caller-named
   uuids with explicit `utimes`. **Mutations:** reversing the comparison
   (`>` to `<`) and taking the first attempt found each fail both new tests.
10. `51ec20d` — **finding 10**, the dispatch test's weak guard. Each declared
    command now states the exit code and reason it refuses a bare invocation,
    and `run` and `replay` are additionally given every session knob so the
    refusal itself is asserted (`run` exit 3 "stdin is not a terminal",
    `replay` exit 3 "No replayable run named absent"). The child gets an
    environment with no `BENCHMARK_` knob so a value on the machine cannot
    change the answer. **Mutation:** weakening `run`'s expected code to 0 fails
    the test.
11. `7026fda` — **finding 14**, deleted the `summary purity` test.
12. `1980157` — **finding 19**, absolute paths on stderr. `displayPath` in
    `config.ts` names a path control-relative when it is under the control
    root, unchanged otherwise. Observed: `show run:absent` prints
    `No record run:absent at .benchmark-runs/absent.json`, and every
    `list attempts` stderr reason now names `.benchmark-runs/sessions/...`
    with no home directory.
13. `0c51cd1` — **finding 13**, `parseRecordId("checkpoint:a/..")` reported an
    id the caller never typed. The id as given, its form, and its body now
    travel as one value. Observed: all three of `checkpoint:a/..`,
    `attempt:session:x/..`, `run:../../etc/passwd` now name themselves exactly.
14. `10a4227` — **finding 15**, `show case:<id>` bypassed `caseIdSchema`.
    `isCaseId` is now the one question the declaration parser, `case show`, and
    the record-id parser ask. Observed: `show 'case:Some Weird Name'` exits 2
    with "names no case: a case id is lowercase letters, digits, or dashes"
    (it exited 3 with an absolute path before); `show case:smoke --json` still
    exits 0.
15. `30bfe6b` — **finding 20**, the `void caseId` escape hatch. The builder now
    yields the group's fields without a case and `group` parses them with the
    case added, so the legacy record is built by never naming a case.
16. `1878b43` — **finding 22**, `show group:<id>` with a missing `report.json`.
    Observed: the summary path now exits 3 with "No report for
    group:group-no-report at .../report.json; its record reads, so --json
    prints it", and `--json` exits 0 printing the record.
17. `721601b` — the refactor pass. Adding the tolerance to `stale` made it the
    third command with the same stderr loop over `{ id, reason }`, identical to
    `list`'s. `writeUnreadable` in `output.ts`, which already owns how a
    command writes each kind of thing, is now the one place. `list attempts`
    output re-observed identical after.

### Criterion 23, as a CLI observation

Criterion 23 asked for an observation against this repository's own
`.benchmark-runs`. It is recorded here rather than asserted in the suite,
because a criterion asking for a one-time observation does not need a permanent
assertion, and the counts grow with every session attempt.

`bun run rehearsal list attempts`, this dispatch, exit 0: eight
`attempt:session:smoke/<uuid>` lines on stdout, each with its case, outcome,
and model (`smoke SUCCESSFUL haiku` and similar). Three record-less attempt
directories named on stderr with their reason —
`attempt:session:smoke/94eee86e-…`,
`attempt:session:zz-symlink-probe/540c4b90-…`, and
`attempt:session:zz-symlink-probe/a2e72959-…`, each
`ENOENT: no such file or directory, open '.benchmark-runs/sessions/…/attempt.json'`.
The tolerance the criterion observes stays pinned by two fixture tests
(`writeUnreadableGroup` for criterion 7, `writeEmptyAttemptDirectory` for the
attempt form).

### Findings recorded, no code change

- **Finding 11.** The traversal fix is correct on POSIX and confinement holds
  for every caller within this change. One caller outside it,
  `resolveRunDirectory` in `replay-command.ts:252-253`, passes the raw `--run`
  argument into the path builder without going through the parser; pre-existing
  and out of scope. `confined` is byte-oriented and assumes POSIX separators,
  so nobody should read a stronger guarantee into it.
- **Finding 12.** Two of the eight traversal test cases are rejected by the
  arity check before reaching confinement, so deleting the confinement calls
  would leave them green. Only the two `attempt:` cases exercise confinement
  for two-segment ids.
- **Findings 16, 17, 18, 21.** `list cases` and `show case:` read the control
  repository rather than the runs directory, so the read-only test does not
  cover the `case:` form; markdown cells are not escaped, reachable only
  through operator-written fixtures; `stale` and `list` join fields with tabs
  while one joined field is an error message that could contain a tab; and
  `latestAttemptRecord` re-walks the sessions tree once per case, which is
  nothing at eleven attempts.
- **A corpus file's absolute path still reaches stderr through
  `CorpusFileError`.** `stale --corpus chezmoi:HEAD` printed
  `Corpus file output-styles/brief.md does not exist at /var/folders/…`. The
  message comes from `corpus-file.ts`, shared with `run` and `replay`, and the
  path is outside the control root so `displayPath` leaves it. Finding 19 named
  `recordText` and the listing reasons, which are fixed; widening to the shared
  corpus error was out of scope.
- **One flaky test.** `runReplayConfirmation > cleans completed Judge outcomes
  while preserving a pre-evidence failure` failed once in a full-suite run this
  dispatch and passed on its own and on the next two full runs. Not touched by
  this work; recorded so a later reader does not read one red as a regression.

### Decided autonomously

Nobody was available during this dispatch. Each follows the dispatch's decision
policy and is reversible by João.

1. **`stale` declares `--model` and `--effort`, and requires neither**
   (finding 2). doc-1's surface sketch shows only `[--corpus <source>]`, but
   the glossary's Stale checkpoint entry — "recorded corpus files, model,
   effort, or an upstream checkpoint no longer match the current state" — is
   the settled constraint the fix has to satisfy, and two of those four were
   unreachable. Requiring `--model` the way `run` and `replay` do would break
   bare `rehearsal stale`; `stale` pays for nothing, so a knob it was not given
   asserts nothing and that half of the comparison stays silent. Trigger to
   revisit: a caller who needs `stale` to refuse rather than stay silent about
   an unasserted knob.
2. **A checkpoint compared against a corpus with no CLAUDE.md is a refused
   precondition, not a cause** (finding 4). A missing declared *case* file is a
   staleness cause because the case cannot run against that corpus at all; a
   missing CLAUDE.md means the checkpoint comparison cannot be performed, which
   is a different claim. The case half still answers, which is what the finding
   asked for.
3. **Recency stays mtime; the attempt's start time remains the recorded
   trigger** (finding 9). Persisting it changes `sessionAttemptRecordSchema`,
   a record this card only reads, and a record-shape change carries a
   both-directions compatibility obligation that belongs to the card owning the
   writer. The two-attempt test pins the behaviour either way. Trigger
   unchanged: adding a timestamp to the session attempt record.
4. **`attempt:session:<case>/<uuid>` keeps only confinement, not
   `isCaseId`** (finding 15). Its case segment names a recorded directory
   rather than a declared case; refusing one would make `list` print an id
   `show` rejects, breaking the card's one structural claim.
5. **Findings 13 and 15 are two commits; findings 1 and 6 are two commits.**
   Both pairs touch the same files. 13 and 15 were separated by committing 13's
   parameter-object change alone and re-applying 15 on top, verified green at
   each step.
6. **The `compare` ENOENT became ACT-30 rather than a fix here.** It reproduces
   at `3798639`, before this card's first commit, and lives in `compare`'s
   code. The dispatch scoped this run to the listed findings.

### Left in the tree, not mine

`backlog/tasks/act-25 - …md` was modified before this dispatch began (a
`references: dotfiles:DOT-18` addition). It belongs to no work here and was
left untouched and uncommitted.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-03 02:39
---
Independent review (reviewer agent, one round). Full check at close: typecheck, lint, fmt:check exit 0; bun test 931 pass, 0 fail across 63 files. Axes applied: style, architecture, security, spec conformance, testing, refactoring. No axis skipped.

BLOCKING, all three fixed.

1. stale died on one unreadable attempt record, hiding every other answer. The reviewer wrote a runs directory holding one attempt.json containing "{ not json" and called staleCases: it threw, which maps to execution failure, so the CLI exited 1 printing nothing on stdout, losing every stale checkpoint and every other case. This is the rule the change states about itself: list-command.ts says one unreadable record must not hide the valid ones, criterion 7 makes it a criterion, and the README says an unreadable record is named on stderr while the rest still print. The state is reachable, since a run that dies during the write leaves a truncated record, which is how the three record-less directories on disk came to exist. Fixed in d864e52 following the case list precedent. Removing the catch fails both new tests.

2. stale could never report model or effort staleness. Confirmed by the orchestrator reading both sites: stale passed the manifest's own model and effort into deriveStaleness, comparing them against the checkpoints that same manifest produced, so the comparison was tautologically equal for any normally written record, while replay passes the model the user is about to replay with. Record a run at sonnet, set BENCHMARK_MODEL=opus, and stale reported the checkpoints fresh while replay logged every stage stale. The glossary defines a stale checkpoint by corpus files, model, effort, or upstream checkpoint; two of the four were unreachable, and stale declared no flag to supply them. Fixed in 0e0d7cf: stale now declares --model and --effort, defaulting to what each run recorded so an unnamed knob asserts nothing. Verified by the orchestrator in help output, and by the worker observing "model sonnet is now opus" and "effort none is now high" against a fixture. Reverting the request fails all three new tests.

3. Three tests failed on any machine but this one, so trunk was not releasable. The orchestrator cloned the repository and ran the suite: it failed. The tests asserted exact counts against .benchmark-runs, which .gitignore excludes, so a clone has none of it, and the next smoke run would have broken the suite here too. Fixed in db0e90c: tolerance stays pinned by fixtures, and criterion 23 is recorded as a CLI observation rather than a permanent assertion. Verified by the orchestrator on a fresh clone: this card's three failures are gone.

Five failures remain on a fresh clone and none belong to this card. The orchestrator checked out the shape commit 3798639, before any of this card's code, in a separate clone and saw the identical five. Four are compare dying with a raw ENOENT when .benchmark-runs does not exist, filed as ACT-30 with a reproduction. The fifth is ACT-26.4's loadCase target test, which depends on a repository outside this one and cannot pass elsewhere by design.

SHOULD-FIX, all fixed.

4. stale --corpus crashed on a valid corpus with no CLAUDE.md, reading it unconditionally before enumerating any run, though resolveCorpusSource accepts a directory holding any one of the four kinds. A corpus holding only the output style the smoke case declares gave a raw ENOENT at exit 1 instead of the answer the case half could give. Fixed in 10436b7: the read is lazy and the failure is translated as a refused precondition while the case half still answers.
5. stale --corpus chezmoi:<ref> leaked two temp directories per invocation, each a full home-layout copy, because renderChezmoi cleans up only when the render itself throws and runStale never called discardRender. This also made the README's claim that these commands write nothing false. Fixed in e6115ae; observed against a real render, the temp directory count went 26 to 28 without the fix and 26 to 26 with it.
6. stale silently discarded unreadable case declarations, consuming only the parsed half of listCases while both other callers print the unreadable half. A mistyped corpusFiles entry gave exit 0 with no line and no warning, indistinguishable from fresh. Fixed in d135bf9.
7. stale's skill roots diverged from what replay hashes: a single root under the corpus root versus project-level then user-level. Latent, since the control repository has no .claude directory, but the two commands would silently disagree about the same checkpoint. Fixed in f122d90; the two now print the identical array.
8. The default live-corpus branch, what a bare rehearsal stale takes, was never tested, though it differs meaningfully in which CLAUDE.md it resolves. Covered in 394f642.
9. Most recent attempt by mtime, the decision flagged for the reviewer, was pinned by no test: writeAttemptReading reused one uuid, so no test ever put two attempts for one case on disk, and reversing the comparison or taking the first found left the suite green. The reviewer agreed with the reasoning and named the fragility: mtime is rewritten by cp -r, rsync without -t, tar without -p, and restore-from-backup, and .benchmark-runs is gitignored so moving it between machines requires one of those. Pinned in 0663073 with explicit utimes; both mutations now fail. Persisting the attempt's start time stays the recorded trigger, because it changes a record schema this card only reads.
10. The dispatch test spawned run, replay, and compare asserting only a non-1 exit, so the sole guard against a paid provider call was a refusal in production code this card did not touch. Fixed in 51ec20d to assert each command's specific refusal.
14. The summary purity test called each pure function twice and asserted equality, which no mutation keeping them functions could fail. Deleted in 7026fda; the byte-for-byte tests are what satisfy criterion 12.
13, 15, 19, 20, 22: a refused two-segment id reported an id the user never typed; show case:<id> bypassed the case id schema that case show enforces for the same mistake; absolute home paths reached stderr and error messages the README tells sessions to paste onto shared cards; a lint escape hatch stood in for a builder that never sets the field; and a missing report.json was reported as a missing group. All fixed.

NOTES.
11. The traversal fix is correct on POSIX and confinement holds for every caller within this change. One caller outside it, resolveRunDirectory in replay-command.ts, passes the raw --run argument into the path builder without going through the parser; pre-existing and out of scope. confined is byte-oriented and assumes POSIX separators.
12. Two of the eight traversal test cases are rejected by the arity check before reaching confinement, so deleting the confinement calls would leave them green. Only the two attempt: cases exercise it for two-segment ids.
16, 17, 18, 21: list cases and show case: read the control repository rather than the runs directory, so the read-only test does not cover the case: form; markdown cells are not escaped, reachable only through operator-written fixtures; stale and list join fields with tabs while one joined field is an error message that could contain one; and latestAttemptRecord re-walks the sessions tree once per case, which is nothing at eleven attempts.
A corpus file's absolute path still reaches stderr through CorpusFileError, which is shared with run and replay, so widening finding 19's fix there was out of scope.
One flaky test was seen once and passed on four subsequent runs: runReplayConfirmation cleaning completed Judge outcomes while preserving a pre-evidence failure. Untouched by this work; recorded so a later reader does not read one red as a regression.

The reviewer named two load-bearing strengths the fixes preserved: confinement living in the id parser rather than in seven path builders, with formatRecordId as its true inverse, which makes "every id list prints is one show accepts" a property rather than seven assertions; and the summaries as pure functions tested against committed byte-for-byte literals.

Observed live by the orchestrator: list attempts prints eight attempts on stdout and names the three record-less directories on stderr at exit 0; stale reports case:smoke invalidated by output-styles/brief.md changing, checked against the real digests; show accepts back ids list printed; a crafted traversal id is refused; list bogus and a malformed id exit 2 and an absent record exits 3.

Not observed: the attempt:stage: id against a real replay record, and legacy-record tolerance against a file actually written before caseId existed. Neither exists on this machine; both are fixture-covered and the card says so.

Spend on this card: 0.00 USD. No provider call, by Shape, Build, or the fixes.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
rehearsal list <kind>, show <id>, and stale read the records the harness wrote, without starting a session or a worktree. Record ids are typed and parsed once at the boundary into a discriminated union, with confinement in the parser rather than in seven path builders, so every id list prints is one show accepts back and none can name a path outside the runs directory. show prints the record's own bytes with --json and a pasteable markdown summary otherwise, from pure functions tested against committed byte-for-byte literals. stale reports what a corpus edit invalidated, and now also what a model or effort change would, through its own --model and --effort. One unreadable record is named on stderr while the rest still print at exit 0. Review found three blocking defects, all fixed: stale died on a single bad record and lost every other answer, stale compared the recorded model against itself so it could never report a model or effort change, and three tests asserted counts against a gitignored directory so trunk did not build anywhere but this machine. Ten should-fix defects fixed, including a chezmoi render leaking a home-layout copy per invocation and a path traversal in the id parser found during Build. Five failures remain on a fresh clone, all pre-existing and verified present at the commit before this card: four are ACT-30, one is ACT-26.4's target test which depends on a repository outside this one. Spend: zero, no provider call at any stage.
<!-- SECTION:FINAL_SUMMARY:END -->
