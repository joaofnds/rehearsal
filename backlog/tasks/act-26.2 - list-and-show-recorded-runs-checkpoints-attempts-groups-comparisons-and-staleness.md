---
id: ACT-26.2
title: >-
  list and show recorded runs, checkpoints, attempts, groups, comparisons, and
  staleness
status: Build
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-03 01:14'
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
- [ ] #1 `bun run rehearsal list cases` exits 0 and prints one line per declared case as `case:<id>` followed by its title, including case:audit-log and case:smoke
- [ ] #2 Every id `list` prints, for each of the six kinds, is accepted back by `show`: one test enumerates the ids a listing produced over a built fixture and asserts `show <id> --json` exits 0 for each
- [ ] #3 `list runs` prints one line per recorded run as `run:<name>` with the case, the artifact's status, and whether the run is replayable (a manifest exists); a fixture with one manifested run and one pre-manifest run directory shows both lines, the second marked not replayable
- [ ] #4 `list checkpoints` prints one line per checkpoint of every recorded run as `checkpoint:<run>/<stage>` with its stage and lineage
- [ ] #5 `list groups` prints one line per confirmation group under .benchmark-runs/confirmations as `group:<group-id>` with its case, mode, and rep count
- [ ] #6 `list comparisons` prints one line per comparison report under .benchmark-runs/comparisons as `comparison:<manifest-digest>` with its case count and rep count
- [ ] #7 One unparseable record does not hide the valid ones: with a group directory holding invalid JSON beside two valid groups, `list groups` exits 0, prints the two valid lines on stdout, and prints one stderr line naming the unreadable id and the reason, following the `case list` precedent
- [ ] #8 `list <kind>` over an empty or absent .benchmark-runs directory exits 0 and prints nothing on stdout
- [ ] #9 `list bogus` exits 2 and names the accepted kinds on stderr, printing nothing on stdout
- [ ] #10 `show run:<name> --json` exits 0 and prints exactly the bytes of the run's artifact.json on stdout, which JSON.parse accepts; the same holds for `show checkpoint:<run>/<stage>`, `show group:<id>`, `show comparison:<digest>`, `show case:<id>`, and both attempt forms, each printing the bytes of the one record file it names
- [ ] #11 `show <id>` without --json prints a markdown summary on stdout and no JSON: for a run, one row per stage with its grade and verdict plus the final verdict and total cost; for a group, the reliability summary with success rate, standard error, and pass^k, and the group's cost; for a comparison, one row per contrast with the paired mean delta and standard error beside the control arm
- [ ] #12 Each summary is a pure function from a parsed record to a string: three tests assert the markdown for a fixture record equals a committed expected string byte for byte, with no file read and no clock in the function
- [ ] #13 `show` with no argument exits 2 naming the id forms; `show nonsense` exits 2 naming the unknown prefix; `show run:absent` exits 3 naming the record that does not exist, printing nothing on stdout
- [ ] #14 A malformed id whose prefix is known but whose body is wrong (`show checkpoint:only-one-part`) exits 2 and names the form that prefix takes
- [ ] #15 `show group:<id>` over a group record written without caseId exits 0 and its summary names the case as audit-log, showing the legacy default the parser already applies reaches the summary
- [ ] #16 `bun run rehearsal stale` exits 0 and prints one line per stale checkpoint as `checkpoint:<run>/<stage>` followed by its causes, over a fixture whose recorded corpus digest for one stage no longer matches the corpus; a fresh checkpoint prints no line
- [ ] #17 `stale` prints one line per stale session case as `case:<id>` naming each declared corpus file whose digest differs from the one its most recent attempt recorded; a case whose attempts all match the current corpus prints no line, and a case with no attempt prints no line
- [ ] #18 `stale --corpus <directory>` reads that source through resolveCorpusSource instead of the live install: over one fixture, the same checkpoint is stale against a directory whose skill bytes differ and fresh against a directory holding the recorded bytes
- [ ] #19 `stale --corpus <nonexistent>` exits 3 with the CorpusSourceError message on stderr and prints nothing on stdout
- [ ] #20 `stale` starts no session and creates no worktree: it makes no provider call, adds no git worktree, and writes no file under .benchmark-runs; a test with a fake command runner asserts no command was run
- [ ] #21 `list` and `show` are read-only: over a fixture .benchmark-runs, a directory listing and the digest of every file taken before and after every list kind and every show form are identical
- [ ] #22 `bun run rehearsal --help` lists list, show, and stale with one summary line each, and `list --help`, `show --help`, and `stale --help` each exit 0 and print one line per declared flag with its default, generated from the same COMMANDS table
- [ ] #23 `bun run rehearsal list attempts` run against the repository's own .benchmark-runs exits 0, prints one `attempt:session:<case-id>/<uuid>` line per attempt record with its case, outcome, and model for the eight records that exist, and names the three record-less attempt directories on stderr
- [ ] #24 The suite runs offline and free: every test that needs a run, checkpoint, group, or comparison builds it in a temporary directory rather than reading the repository's .benchmark-runs, no test writes into the repository's .benchmark-runs, and no test invokes claude
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
<!-- SECTION:NOTES:END -->
