---
id: ACT-26.5
title: >-
  add the session case kind: a prompt or a resumed transcript with deterministic
  checks
status: Review
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 23:24'
labels: []
dependencies:
  - ACT-26.4
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
  - /Users/joaofnds/code/clean-room/brief-split/STUDY.md
parent_task_id: ACT-26
type: feature
ordinal: 26008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three of the four bespoke harnesses measured one Claude session, not a pipeline stage: a reply turn resumed from a real transcript cut just before the fired reply (dotfiles doc-4, brief-split), a single prompt in a repository under a style variant (doc-3), and an agent reviewing a fixture tree against an answer key (instructions-reviewer cases). Add the session case kind. A session case declares: a working directory or fixture tree, the prompt, an optional transcript prefix to resume (with rehearsal case capture <session> --cut <index> doing what fork.py did: copy the session file truncated at the cut and rewrite the session id), tool and settings overlays, the agent or style under test, and the corpus files it reads so lineage and staleness cover styles, agents, and rules. Its judge is a deterministic check list over the reply and transcript (word band, forbidden characters such as em dash and backtick, every question in the reply present in the draft, an agent dispatched in the foreground with named message parts, sent reply equal to the return minus whole sentences, files read, tool calls made), optionally a known-answer key or rubric graded by the sealed Judge. A session case runs once as a debug attempt and under --confirm as reps, with the same records, reports, and cost ceiling as a stage replay. ACT-25 becomes the first session case.

Cost observed for one resumed turn: about 2 USD cold, 0.15 USD with a warm cache. Gap 2 in doc-1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 cases/smoke/case.json declares kind session with prompt "Reply with the single word OK.", tools [], no transcript, and two checks (word-band max 1 over the reply, tool-calls max 0 over the transcript); rehearsal case show smoke --json exits 0 and prints it back through the same schema that loaded it
- [x] #2 A session declaration that names a fixture path outside its case directory (leading slash or .. segment) is refused at load with an error naming that path, and a session declaration carrying a pipeline field is refused naming the unrecognized key
- [x] #3 loadCase("smoke") returns a value whose kind is session carrying prompt, tools, and checks, and loadCase("audit-log") returns a value whose kind is pipeline carrying its task, brief, rubrics, and pipeline: one test asserts both, and the audit-log assertions are the ones ACT-26.4 already recorded, unchanged
- [x] #4 The word-band check reports PASS when the reply's word count is inside [min, max] and FAIL naming the count and the band when it is outside; a table-driven test covers a reply below min, at min, at max, above max, and a band that declares only max
- [x] #5 The forbidden-text check reports FAIL naming each declared string the reply contains and PASS when it contains none; the declared strings come from the case (an em dash and a backtick are case data, not constants in the check)
- [x] #6 The tool-calls check counts tool_use records in the transcript and reports FAIL when the count is outside [min, max] or when a call names a tool outside the declared names, naming the offending tool; a transcript with zero tool_use records passes max 0
- [x] #7 The files-read check reports PASS when every declared path appears as the file_path of a Read tool_use in the transcript and FAIL naming each declared path that does not
- [x] #8 A check list result is successful when and only when every check passes: a test asserts one failing check among four passing ones makes the attempt unsuccessful and the record names which check failed
- [x] #9 rehearsal case capture smoke --session <id-or-prefix> --cut 3 writes .benchmark-runs/cases/smoke/<file>.jsonl holding exactly lines [0,3) of the source session file, records file, sha256, sourceSession, and cut in cases/smoke/case.json, exits 0, and prints the updated declaration with --json
- [x] #10 case capture streams the source file line by line: a test over a source larger than the capture buffer asserts the written prefix is byte-identical to its first cut lines and that the whole source is never held as one string
- [x] #11 case capture --session <prefix> resolves a unique prefix to one session file and exits 3 naming both candidates when the prefix matches more than one, and exits 3 naming the prefix when it matches none
- [x] #12 case capture --cut with an index of 0, a negative index, or an index past the source's line count exits 2 naming the index and the source's line count
- [x] #13 An attempt runs in a fresh temporary directory the harness creates, seeded from the case's fixture/ tree when one is declared: a test with a fake runner asserts the working directory the runner received is not the control repository and not the case directory, and that it holds a copy of the fixture's files
- [x] #14 A session case with a transcript forks it into ~/.claude/projects/<slug of the attempt directory's real path>/<fresh uuid>.jsonl with every occurrence of the source session id replaced by that uuid, and a test over a two-record fixture asserts the forked bytes differ from the source only in the session id
- [x] #15 The slug of an attempt directory is its real path with every / replaced by -: a test asserts /private/tmp/x maps to -private-tmp-x and that a path given as /tmp/x on macOS resolves through its real path first
- [x] #16 After an attempt the projects slug directory holds no file the attempt created: cleanup diffs the directory listing taken before the run against the listing after and removes only entries absent from the first, and a test with a file planted mid-run asserts that file survives
- [x] #17 claudeArgs for a session case produces --tools "" for an empty declared tools list, --tools with the joined names otherwise, --settings with the declared settings JSON, --agents only when agents are declared, --output-format json, --max-budget-usd from the session budget, --model and --effort from the session knobs, --resume <uuid> when a transcript is declared and no --resume when none is, and never --no-session-persistence and never --json-schema
- [x] #18 A session debug attempt writes one record carrying the case id, the reply, the path of the transcript copy under the attempt record, the provider call metrics, and one result per declared check; rehearsal run --case smoke --json prints exactly that record and it parses with the schema that wrote it
- [x] #19 confirmationRepRecordSchema and confirmationGroupRecordSchema accept mode session at schemaVersion 1, with the check list as one stage entry and finalOutcome NOT_APPLICABLE, and a v1 record written before this card (mode stage or pipeline) still parses unchanged: a test asserts both
- [x] #20 projectConfirmationCost for mode session is reps x one session at the session budget: a test asserts 3 reps at 0.2 USD projects 0.60 USD total, and rehearsal run --case smoke --confirm --reps 2 --yes prints that projection before any provider call
- [x] #21 The lineage of a session attempt hashes the transcript digest, the fixture tree, the prompt, the tool and settings overlays, and the declared corpus files' bytes: a test asserts the key changes when a declared corpus file's bytes change and is unchanged when an undeclared file beside it changes
- [x] #22 Corpus files declared in corpus layout paths resolve through one function to the live install (output-styles/<name>.md to ~/.claude/output-styles/, agents/<name>.md to ~/.claude/agents/, skills/<name>/... to ~/.claude/skills/, CLAUDE.md to the control root), and a declared corpus file that does not exist is refused before any provider call, naming the resolved path
- [x] #23 rehearsal run --help lists the flags a session case uses and rehearsal --help lists case capture with its summary; running rehearsal run --case smoke --pipeline <path> exits 2 naming --pipeline as a flag a session case does not take
- [x] #24 rehearsal run --case smoke --model haiku --effort low --session-budget-usd 0.2 exits 0, writes the attempt record with the reply, the transcript copy, the metrics, and a passing check list, and prints that record with --json (the paid observation, capped at USD 2)
- [x] #25 A two-turn session captured at the cut after its first answer, run with the prompt "What was the codeword? Reply with only the codeword." and a forbidden-text check over the wrong word, passes: the resumed attempt names the codeword from the transcript prefix, and the projects directory holds no file the attempt created
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decided 2026-09-02: transcript bytes for a session case are git-ignored under .benchmark-runs/cases/ and hashed into lineage; the case declaration is committed.

## Goal

`rehearsal` gains a second case kind, `session`: one Claude session in a fresh
attempt directory, optionally resumed from a transcript prefix, judged by a
deterministic check list, recorded and confirmed like a stage replay.

## Unknowns, and how each was resolved from the repository

Read before asked. Every resolution below cites a file or a tool result from
this dispatch.

1. **Whether a session case can be a `BenchmarkCase`.** Read
   `src/benchmark/case.ts`: `BenchmarkCase` is one flat record of
   `task`, `productBrief`, `finalRubric`, `finalRubricPath`, `rubricsDirectory`,
   `pipelinePath`, `pipeline`, `stageRubrics`, `targetPath` — every field
   pipeline-only, every one required. Resolved: `loadCase` returns a
   discriminated union, `LoadedCase = PipelineCase | SessionCase`, discriminated
   on the same `kind` the declaration carries. `BenchmarkCase` keeps its name
   and its fields and becomes the `pipeline` member, so nothing that consumes it
   changes; `requireCase` gains a narrowing helper per command. This is §5's
   parse-don't-validate: after the load, a session case cannot be asked for a
   pipeline.
2. **Whether `parseArgs` can produce a config for a session case.** Read
   `src/benchmark/config.ts`: `parseArgs` takes `CaseDefaults` with a required
   `pipelinePath` and `targetPath`, resolves `--target`/`BENCHMARK_TARGET_DIR`,
   throws "Provide --target or BENCHMARK_TARGET_DIR" when the chain is empty,
   and returns `BenchmarkConfig` with a required `sourceDir` and `pipelinePath`.
   A session case declares neither. Resolved: `parseSessionArgs` beside
   `parseArgs`, sharing `parseSessionKnobs` and `parseConfirmation` (both
   already extracted), returning a `SessionRunConfig` of caseId + session knobs
   + confirmation. `run` picks the parser by the loaded case's kind, which it
   already loads first (ACT-26.4's decision 6). `--target` and `--pipeline` on a
   session case are usage errors naming the flag.
3. **Whether the confirmation records can carry a session rep without a version
   bump.** Read `src/benchmark/confirmation-record.ts` and its consumers
   (`comparison-loader.ts:131`, `comparison-comparability.ts:29,209`,
   `comparison-quality.ts:60`, `comparison-resources.ts:156`,
   `confirmation-evidence.ts:176-215`): every one indexes reps by
   `declaredStages`, and the rep schema requires `stages` (min 1), a
   `finalOutcome`, and a `worktreePath`. Loosening those to optional would make
   every stage-indexed reader branch. Resolved: a session rep is one stage entry
   named `checks`, graded `A` when the check list passes and `F` when it does
   not, with `finalOutcome: NOT_APPLICABLE` and `worktreePath` = the attempt
   directory. Then `mode` gains `"session"` to the existing enum, and the
   schema's success rule needs one edit: the `NOT_APPLICABLE` branch that today
   reads `mode === "stage"` becomes `mode !== "pipeline"`. `schemaVersion` stays
   1, no field becomes optional, and every record on disk still parses.
   Decision policy rule 4 is satisfied by not changing the shape at all.
4. **What "the reply" is.** Read `src/benchmark/claude.ts` and
   `contracts.ts:176`: `claudeEnvelopeSchema` has `result?: string`, and
   `readClaudeEnvelope` already throws on `is_error`. Verified on the installed
   CLI (`claude --help`, v2.1.258) that `--output-format json` exists. Resolved:
   the reply is `envelope.result`; the checks that read the reply read that
   string. A session case passes no `--json-schema`, so
   `readStructuredOutput` is not on this path.
5. **Whether `claudeArgs` can serve a session case as it stands.** Read it: it
   always emits `--json-schema` (required parameter `schema`), always emits
   either a session id or `--no-session-persistence`, and picks tools from
   `access` alone (`sealed` → `--tools ""`, otherwise
   `--dangerously-skip-permissions`). A session case needs a declared tools
   list, `--settings`, sometimes `--agents`, `--resume`, no schema, and
   persistence on. Resolved: `sessionCaseArgs` in the same module, built from
   the same `SessionSettings`, so both builders keep one home for the flag
   spellings. Not a fifth `access` value on `claudeArgs`: the two invocations
   differ in six flags, and one function taking a mode flag to pick between them
   is the control-flow-in-the-helper smell core.md names.
6. **How the transcript is read back after a resumed run.** Verified this
   dispatch: `~/.claude/projects/` entries are the working directory's real path
   with `/` replaced by `-` (`-private-tmp-...` entries exist, and the machine
   is macOS where `/tmp` is a symlink to `/private/tmp`). Read a real session
   file: JSONL, one record per line, `sessionId` on every record including the
   `queue-operation` and `user` records, and `cwd` on user records. The
   dispatch's trap says a resumed headless session is given a further session id
   and writes a new file. Resolved: the attempt lists the slug directory before
   the run and after, and the transcript it copies is the entry the second
   listing has and the first does not; cleanup removes exactly those entries.
   Never a delete by pattern, and never the id the fork wrote.
7. **What a `tool_use` record looks like, for the transcript checks.** Read a
   real transcript with a script this dispatch: assistant records carry
   `message.content` as an array whose `tool_use` blocks have `name` and
   `input`, and a `Read` block's input is `{"file_path": "<absolute path>"}`.
   Resolved: `tool-calls` counts `tool_use` blocks and reads their `name`;
   `files-read` reads `input.file_path` of the `Read` ones. Both parse each line
   with a zod schema that is `.loose()` and tolerant of unknown record types,
   because the transcript format is the provider's, not ours, and a record shape
   we do not recognize must not fail an attempt.
8. **Whether `--tools ""` and the other flags exist on the installed CLI.**
   Verified this dispatch against `claude --help` (v2.1.258): `--tools <tools...>`
   documents `""` as "disable all tools"; `--settings <file-or-json>` accepts
   inline JSON; `--agents <json>`, `--resume`, `--max-budget-usd`, and
   `--output-format` all exist. What is *not* verified and Build must observe
   before relying on it: that `--settings` with `outputStyle` is honored on
   `--resume` in `-p` mode. The smoke case is the cheap observation for it.
9. **Whether the two ACT-25 checks about an agent hand-off have a referent.**
   Verified this dispatch: `~/.agents/agents/` holds only `reviewer.md`, and
   `grep -in "agent|Request|Draft|subagent" ~/.claude/output-styles/brief.md`
   returns only three unrelated prose lines — no dispatch instruction, no
   Request/Draft protocol. The mechanism ACT-25 describes is gone. Resolved:
   those two checks are not built; see "Not built, and why". This is the
   constraint-testing rule in the shape skill: the prohibition is backed by a
   direct observation, not by a predicted cost.
10. **Where the corpus files a session case declares resolve.** Verified this
    dispatch: `~/.claude/agents` is a symlink to `~/.agents/agents`;
    `~/.claude/output-styles/` holds `brief.md`; `~/.claude/skills/` holds the
    stage skills; `config.ts:18` already owns `PROJECT_INSTRUCTIONS_PATH` for
    `CLAUDE.md`. Resolved: one function, `resolveCorpusFile(layoutPath)`, maps a
    corpus layout path onto the install, and it is the only place that knows
    about `~/.claude`. ACT-26.6 replaces its body with a corpus source and
    nothing else moves.
11. **Whether lineage machinery has to be rebuilt for a session attempt.** Read
    `src/benchmark/checkpoint.ts`: `lineageKey` hashes
    `{upstream, corpusFiles, model, effort}` with a comment forbidding any extra
    field, and `HashedFile`, `hashDirectory`, and codepoint-ordered
    `canonicalFiles` are already there. Resolved: reuse them. The session
    attempt's `upstream` is the digest of everything frozen that is not corpus —
    transcript digest, fixture tree hash, prompt, tools, settings, agents —
    hashed into one string, so `lineageKey` keeps its four fields and its
    invariant, and a corpus edit still invalidates through `corpusFiles`.
12. **Where the smoke case's cost lands.** From the card: a resumed turn cost
    about 2 USD cold and 0.15 USD warm. The smoke case resumes nothing, has no
    tools, and asks for one word on haiku, so the dispatch's "about a cent" is
    the right order. The `--session-budget-usd 0.2` in the observation is the
    ceiling, not the estimate, and `--max-budget-usd` enforces it provider-side.

## Decided autonomously

Nobody answers questions in this run. Each decision follows the dispatch's
decision policy in its stated order and can be reversed by João.

1. **`loadCase` returns a discriminated union; `BenchmarkCase` becomes the
   `pipeline` member unchanged.** Reason: policy rule 2 and doctrine §5. The
   alternative — one record with every session field optional — is exactly the
   illegal state parse-don't-validate exists to remove, and it would make every
   current consumer of `BenchmarkCase` handle a case that cannot occur.
2. **A session run gets its own config parser (`parseSessionArgs`), sharing the
   session-knob and confirmation parsing.** Reason: `parseArgs`'s required
   `sourceDir` and `pipelinePath` have no meaning for a session case, and
   defaulting them to empty strings would put a lie in `BenchmarkConfig`.
   `--target` and `--pipeline` on a session case become usage errors, which is
   the behavior criterion for it.
3. **The confirmation records take `mode: "session"` at schemaVersion 1 with the
   check list as one synthetic stage named `checks`, rather than a v2 bump or a
   new optional shape.** Reason: decision policy rule 4 asks that records stay
   readable in both directions, and this adds no field and loosens none — every
   v1 record on disk parses unchanged, and every stage-indexed reader
   (comparison quality, resources, comparability) works without a branch. The
   one edit is the schema's success rule, where `mode === "stage"` becomes
   `mode !== "pipeline"`. The cost is that a session rep's "stage" is a
   vocabulary stretch; it is paid once, in the record, and the glossary's Rep
   outcome entry states what it means.
4. **`sessionCaseArgs` is a second builder in `claude.ts`, not a mode on
   `claudeArgs`.** Reason: core.md's rule that a helper taking a flag telling it
   which path to run has inherited control flow. The two invocations differ in
   six flags. They share `SessionSettings` and the module, which is what keeps
   one home for the spellings.
5. **Four check kinds, one module each, in a zod discriminated union.** Reason:
   the card and doc-1 name exactly these as deterministic and the dispatch
   settles them. A fifth kind is an entry in the union; a rubric-graded check is
   not built (below).
6. **The em dash and the backtick are `forbidden-text` strings a case declares,
   never constants in the check.** Reason: the direction settles it, and it is
   also what keeps the check kind reusable: a constant here would make the kind
   mean "the brief style's rules" instead of "these strings".
7. **The transcript is parsed with a `.loose()` per-line schema that ignores
   record types it does not recognize.** Reason: doctrine §5's parse at the
   boundary, against a format we do not own. A strict schema would turn a
   provider's new record type into a failed attempt, which is a false negative
   on the thing being measured.
8. **Cleanup diffs the slug directory's listing before and after, and deletes
   only entries the diff shows the attempt added.** Reason: the dispatch's
   observed trap — live session files have appeared in a project directory
   mid-run — and the hard line about looking before deleting. A pattern delete
   or an id-based delete would eventually take one of João's files.
9. **The attempt directory is created by the harness under the OS temp root and
   removed after the attempt, with the transcript copied into the attempt
   record first.** Reason: the direction settles "never a live repository"; the
   record is the durable artifact, per the vision's log-first principle and
   doc-1's Inspect AI prior art.
10. **A declared corpus file that does not resolve is refused before any
    provider call.** Reason: the vision's "projected cost is shown before a
    multi-rep run, not after" and the exit-code contract's refused
    precondition (3). Discovering a missing style after paying for a session is
    the failure this ordering prevents.
11. **`case capture` writes the declaration back into `cases/<id>/case.json`.**
    Reason: the direction says the digest is recorded in the declaration, and
    the declaration is the committed artifact. The alternative — printing the
    fields for a human to paste — is the "say the word and I'll do X" defect.

## Not built, and why

Each is named by the card, ACT-25, doc-1, or the direction, and no declared case
needs it. The trigger that would build it is named.

- **The check "an agent was dispatched in the foreground with Request and Draft
  parts" and the check "the sent reply equals the agent's return minus whole
  sentences".** Verified this dispatch that the mechanism is gone:
  `~/.agents/agents/` holds only `reviewer.md`, and `~/.claude/output-styles/brief.md`
  contains no dispatch protocol. A check with no referent cannot fail
  informatively and would encode a corpus shape that was reverted. Trigger: a
  corpus in which a style hands a reply to an agent again; then the check kind
  is `agent-dispatch`, one more member of the union.
- **The check "every question in the reply is present in the draft".** Same
  trigger: it reads the draft the reverted hand-off produced, and there is no
  draft without it.
- **A known-answer key or a rubric graded by the sealed Judge for a session
  case.** doc-1 names both as options. No declared case needs one: the smoke
  case and ACT-25's turns are deterministic, and the vision ranks deterministic
  first. Trigger: importing the instructions-reviewer known-answer cases, which
  need recall and precision against a key.
- **`--corpus` and corpus variants.** ACT-26.6. This card resolves corpus files
  against the live install through one function so that card replaces one body.
  Trigger: that card.
- **ACT-25 itself as a declared case.** It needs four real transcripts captured
  from João's own sessions and about 2 USD per turn. This card builds the kind
  and proves it on the smoke case; ACT-25 declares its own case with the
  capture command this card ships. Trigger: ACT-25.
- **A `fixture/` tree in the smoke case.** The smoke case declares no fixture,
  so the seeding path is exercised by unit tests over a temporary source tree
  rather than by a committed fixture. Trigger: the first case that needs files
  on disk (the known-answer cases).
- **Parallel session reps.** Stage confirmation runs reps in parallel worktrees;
  a session rep's isolation is its attempt directory, so parallelism is
  available, but nothing measures it yet and serial reps keep the projects
  directory's before/after diff unambiguous. Trigger: a session case whose
  confirmation wall-clock is the complaint.

## Implementation plan

Ordered so each step is committable with the suite green, and the walking
skeleton comes before the features (doctrine §2). Steps 1-3 need no provider
call; the paid observation is step 8.

1. **The declaration.** `sessionCaseDeclarationSchema` as the second member of
   the existing `caseDeclarationSchema` union, `cases/smoke/case.json`, and
   `loadCase` returning `LoadedCase`. `case list` and `case show` handle both
   kinds. The existing audit-log characterization stays green, which is what
   proves the union did not disturb the pipeline member.
2. **The check kinds.** `src/benchmark/session-check/` with one module per kind
   and `index` holding the union and the list evaluator. Table-driven tests per
   kind; the transcript-reading kinds take parsed records, not a file path, so
   they stay pure.
3. **The transcript reader.** `src/benchmark/transcript.ts`: streaming line
   parse (`Bun.file().stream()`, never `.text()`), the loose per-line schema,
   `toolUses()` and `filesRead()` projections, and the fork rewrite. Tested over
   a small fixture written to a temporary directory.
4. **`case capture`.** The command-table entry, `src/cli/case-command.ts`'s
   third verb, session-file resolution by id or unique prefix, the streamed
   prefix copy under `.benchmark-runs/cases/<case>/`, the digest, and the
   declaration write-back. `.gitignore` already ignores `.benchmark-runs/`.
5. **The attempt.** `src/benchmark/session-attempt.ts`: create the attempt
   directory, seed the fixture, fork the transcript into the slug directory,
   list the slug directory, invoke through an injected runner
   (`ClaudeCommand`, the seam workflow.ts already uses), list again, copy the
   new transcript into the attempt record, delete only the added entries,
   remove the attempt directory. Every collaborator injected; the whole module
   tested with a fake runner that writes a canned transcript, which is the
   walking skeleton and the reason no test needs a provider.
6. **The debug record and `run`.** The attempt record schema, `parseSessionArgs`,
   the run command's dispatch on the loaded case's kind, and `--json`. At this
   point `rehearsal run --case smoke` is runnable end to end against a fake.
7. **Lineage and the corpus resolver.** `resolveCorpusFile`, the frozen-input
   digest, `lineageKey` reuse, and the refusal for a corpus file that does not
   resolve.
8. **The paid observation.** `run --case smoke --model haiku --effort low
   --session-budget-usd 0.2`, then the synthetic two-turn capture-and-resume,
   both as the dispatch describes. Record the cost on the card.
9. **Confirmation.** `mode: "session"` in the two schemas, the synthetic
   `checks` stage, `projectConfirmationCost` for the mode, and the group and
   report path. Then `--confirm --reps 2 --yes` on the smoke case.
10. **README and CLAUDE.md.** The session case layout, `case capture`, and the
    check kinds in the Inputs section.

## First test to write

In `src/benchmark/case.test.ts`, beside the audit-log characterization that
ACT-26.4 left there:

> `loadCase` returns the smoke case as a session case carrying its prompt,
> its empty tools list, and its two checks

Arrange nothing but the repository; act by calling `loadCase("smoke")`; assert
the loaded value's `kind` is `"session"`, its `prompt` is
`"Reply with the single word OK."`, its `tools` is `[]`, and its `checks` deep-equal
the two declared checks. It fails now because `cases/smoke/` does not exist and
the schema has one member. It is the smallest thing that forces the union, the
declaration, and the smoke case into existence together, and it is the assertion
the whole rest of the card leans on: every later step reads a `SessionCase`.

The second test is the check list's own walking skeleton — "a check list of one
word-band check reports the attempt successful when the reply is one word" —
which forces the check union, the evaluator, and the reply-versus-transcript
split before any invocation code exists.

## Build handoff

### What changed

`rehearsal` has a second case kind. `loadCase` returns `LoadedCase =
BenchmarkCase | SessionCase`; `BenchmarkCase` keeps its name, its fields, and
every current consumer, and gained only a `kind: "pipeline"` discriminant.
`requirePipelineCase` and `requireSessionCase` narrow at each boundary.

New modules: `session-check.ts` and its four kind modules with
`session-check-result.ts`; `transcript.ts`; `session-capture.ts`;
`session-attempt.ts`; `session-lineage.ts`; `session-record.ts`;
`corpus-file.ts`; `json-value.ts`; `src/cli/session-run-command.ts`.
`cases/smoke/` is committed. `parseSessionArgs` sits beside `parseArgs`;
`sessionCaseArgs` sits beside `claudeArgs`; `hashDirectory` is now exported
from `checkpoint.ts` and serves both lineages.

### What became possible but is not wired up

- **A session confirmation group.** `mode: "session"` parses in both records
  and `projectConfirmationCost` projects it, and `--confirm` prints the
  projection, but the group itself refuses with exit 3 and a message saying so.
  Nothing pays for a group that does not exist. Building it is a card.
- **A `fixture/` tree.** The seeding path is built and unit-tested over a
  temporary tree; no committed case declares one.
- **`files-read` against a corpus file.** Built and unit-tested; no declared
  case uses it, because the smoke case has no tools.
- Callers still on the old path: none. `run` dispatches on the loaded kind;
  `replay` and `compare` are pipeline-only and untouched.

### What was observed directly, and how

Six paid haiku calls, 0.086929 USD total, all recorded below.

- `bun run rehearsal run --case smoke --model haiku --effort low
  --session-budget-usd 0.2 --json` exits 0, reply `OK`, both checks PASS,
  cost 0.016883 USD (AC 24).
- A two-turn haiku session in `/tmp/rehearsal-codeword` established the
  codeword PLUMBAGO (0.016881 USD) and answered a second question
  (0.001077 USD). `case capture` at cut 10 wrote a prefix `cmp`-identical to
  the source's first ten lines. Running that case with the prompt "What was
  the codeword? Reply with only the codeword." replied `PLUMBAGO`, which
  appears nowhere in the prompt (0.017128 USD, twice: once before and once
  after the transcript fix below). The attempt's transcript copy holds 19
  lines, the forked 10 plus the 9 the resumed turn appended (AC 25).
- The projects directory listing was snapshotted before the first paid call
  and `diff`s clean against it now. No `*.jsonl` remains under any
  `rehearsal-attempt-` slug.
- `run --case smoke --confirm --reps 2 --yes` printed
  `Projected maximum cost: $0.40 (2 reps x $0.20)` and exited 3 with no
  provider call (AC 20).
- `run --case smoke --pipeline <path>` exits 2 naming `--pipeline` (AC 23).
- A temporary case declaring `output-styles/brief.md`, `agents/reviewer.md`,
  `CLAUDE.md`, and `skills/build/SKILL.md` resolved all four onto the live
  install and hashed them (0.017832 USD); the same case declaring a style that
  does not exist exited 3 naming the resolved path, with no provider call
  (AC 22). The case was deleted, never committed.
- `case capture` refusals: an ambiguous prefix and an absent one exit 3; cuts
  of 0, -1, and 999999 exit 2 naming the index and the source's 520 lines, and
  the declaration is unchanged after each (AC 11, 12).
- Full gate on the final tree: `bun run typecheck` 0, `bun run lint` 0,
  `bun run fmt:check` 0, `bun test` 659 pass 0 fail. `git status` clean.

### Three harness facts the observations settled

1. **`--tools ""` removes every tool.** Confirmed indirectly: the smoke case
   declares `tools: []`, ran, and its `tool-calls max 0` check passed with
   zero `tool_use` records in the transcript.
2. **A resumed headless session does NOT get a further session id.** The card's
   trap said it does. Observed on claude 2.1.258: it keeps the id it resumed
   and appends to that file. The design adapted rather than retuning: the
   transcript to read back is the new entry when the listing diff finds one and
   the forked file otherwise, which covers both behaviors.
3. **`--settings` with `outputStyle` on `--resume` in `-p` mode: NOT observed.**
   No declared case needed a settings overlay, so paying for a call to check it
   would have been spend without a consumer. `sessionCaseArgs` emits the flag
   and its shape is unit-tested; whether the provider honors it on a resume is
   unverified. The first case that declares `settings` must observe it.

### Defects found and fixed on the way

Each stopped the feature work and took its own commit.

- `e462089` The envelope schema was loose but the `usage` object nested in it
  was strict, so the seven fields claude 2.1.258 now reports made
  `readClaudeEnvelope` throw and every run fail after paying. Pre-existing,
  affected the stage path too, no test pinned it.
- `a5e0652` Cleanup deleted the provider's transcript from inside the recording
  path, so an attempt that threw left the file in the projects directory.
  Observed: the first smoke run did exactly that.
- `7870caf` The attempt recorded an empty transcript for a resumed case,
  because it looked only for a new slug entry. See fact 2 above.
- `df5c2af` An ambiguous session prefix printed all 88 matching ids. Now the
  count leads, five ids follow, and the message says what to do.

### What was not verified

- `--settings` and `--agents` on a real call. Both flags' spellings are
  unit-tested; neither has been sent to the provider.
- The `files-read` check against a real transcript. Its projection is tested
  against transcript records read from a real session file's shape, but no
  paid call has exercised it end to end.
- A confirmation group of session reps, since it is not built.
- Parallel session reps. Serial keeps the slug diff unambiguous; nothing
  measures wall clock yet.

### A wording note on AC 16

The AC says cleanup "removes only entries absent from the first" listing and
also that a file planted mid-run survives. Those conflict, because a file
another session writes mid-run is also absent from the first listing. The
implementation takes the stricter reading that satisfies both: it removes only
the two files the attempt is known to have created (the one it forked and the
one the diff attributes to its own run), never every new entry. The test that
plants a file mid-run fails against a blanket delete, verified by mutation.

### Refactor pass

`session-lineage.ts` had grown its own copy of the directory walk that
`checkpoint.ts` already had: same recursive read, sort, file filter, and
digest, differing only in a path prefix. Two copies of how a tree becomes
lineage inputs can disagree, and a lineage key that differs by walk is a stale
checkpoint nobody can explain. Unified in `e4cede6`, behavior preserving, the
same 41 tests green either side.

### Review is due

The `review` skill's triggers apply: this is a new case kind across eleven
commits, it touches the confirmation record schema every comparison reader
indexes, and it deletes files under `~/.claude/projects`. The cleanup path and
the schema's success rule are where a reviewer's attention pays.

## Decided autonomously during Build

The shape record's eleven decisions stood. These are the ones Build had to make,
each by the dispatch's policy in its stated order.

1. **The check modules are flat files named `session-check-*.ts`, not a
   `session-check/` directory.** Reason: the project's `import/no-relative-parent-imports`
   lint rule forbids a subdirectory module importing `../transcript`, and an
   exception is a design decision the style skill says to avoid. Flattening
   needed no exception and cost only a file-name prefix.
2. **`--tools ""` on a session case's overlay JSON is typed as `JsonValue`, a
   new module, rather than `Record<string, unknown>`.** Reason: the
   `anti-slop/no-unsafe-dictionary-type` guard refuses the dictionary of
   unknowns, and the honest type for a value re-serialized verbatim and never
   reached into is JSON.
3. **The exhaustive `default` branch is one shared helper, `unhandled(value,
   subject)` in `contracts.ts`.** Reason: two lint rules disagree (one requires
   a `default`, one requires exhaustiveness), and a `default` that returns the
   last case silently swallows a new union member. A `never`-typed parameter
   satisfies both honestly. It lives in `contracts.ts` rather than its own file
   because `import/prefer-default-export` would demand a default export, and
   this project has none.
4. **`ConfirmationMode` has one home in `confirmation-record.ts`; the
   comparison report imports it.** Reason: adding `session` revealed that the
   comparison report carried a second copy of the same three-value enum that
   could drift. The dependency runs from the comparison toward the records it
   reads, which is the right direction.
5. **A session case skips the review-pause TTY gate.** Reason: the gate exists
   for the stage graph's pause between stages, and a session attempt has no
   stage to pause between. Requiring a TTY would have made the harness
   unusable from an agent, which is the point of ACT-26.
6. **`--confirm` on a session case prints the projection and then refuses with
   exit 3.** Reason: the group is not built (below), and the alternative
   orderings are worse: refusing before the projection hides the number the
   vision asks to be shown first, and building the group to satisfy the flag is
   scope the card did not ask for.
7. **The transcript to read back is the new slug entry when the diff finds one
   and the forked file otherwise.** Reason: observation, not preference. The
   card's trap said a resumed session gets a further id; claude 2.1.258 keeps
   the id and appends. Handling both costs one conditional and is correct
   whichever the provider does next.
8. **Cleanup removes the two files the attempt is known to have created, not
   every entry the diff shows as new.** Reason: AC 16 asks for both "only
   entries absent from the first" and "a file planted mid-run survives", and
   only the stricter reading satisfies both. The hard line about João's files
   settles which way to err.
9. **The four defects found mid-build were fixed in their own commits rather
   than filed.** Reason: the build skill's rule that a defect stops the feature
   work, and each was small, reversible, and blocking the observation the card
   required.

## Not built, and why (Build additions)

- **A session confirmation group.** The records, the projection, and the
  approval gate accept `mode: "session"`, but no group executes reps. Building
  it needs a rep record writer, a group writer, and a report path, which is a
  card's worth of work the acceptance criteria did not ask for: AC 19 asks the
  schemas to accept the mode and AC 20 asks the projection to print. Trigger:
  the first session case whose single rep is not enough evidence, which is
  ACT-25.
- **Observing `--settings` with `outputStyle` on a resume.** The dispatch named
  it as one of three facts to check, and it is the one no declared case needs:
  the smoke case and the codeword case both declare no settings overlay, so a
  paid call to check it would buy a fact with no consumer today. Trigger: the
  first case that declares `settings`, which is ACT-25's style variants.

## Paid calls on this card

Six haiku calls, 0.086929 USD total, against a ceiling of 2.00 USD.

| call | cost USD |
|---|---|
| `run --case smoke` (failed on the usage-schema defect, then fixed) | 0.016883 |
| codeword turn 1, establishing PLUMBAGO | 0.016881 |
| codeword turn 2, resumed | 0.001077 |
| `run --case zz-codeword-probe`, before the transcript fix | 0.017128 |
| `run --case zz-codeword-probe`, after the transcript fix | 0.017128 |
| `run --case zz-corpus-probe`, resolving four corpus files | 0.017832 |

Unpaid observations: the `--confirm` projection, the `--pipeline` refusal, the
corpus refusal, and every `case capture` refusal all completed without a
provider call.

## Review fixes (Build, directed)

Eleven commits, one per finding, each test-first where a test could pin it. No
paid provider call: spend for this dispatch was $0.00. Full gate on the final
tree: `bun run typecheck` 0, `bun run lint` 0, `bun run fmt:check` 0,
`bun test` 691 pass 0 fail. `git status` clean.

| finding | commit | what the fix was |
|---|---|---|
| 3 | `2e1153c` | `resolveCorpusFile` confines a declared path to the install, like `caseRelative` does everywhere else |
| 1, 2, 9 | `8679d32` | the attempt names its own session, so cleanup deletes the one file it owns and the slug goes with `rmdir` |
| 4 | `276dc37` | a missing envelope result is the `NO_REPLY` outcome, not a reply of zero words |
| 6 | `383c6cf` | the capture streaming assertion is absolute and counts observations |
| 5 | `68cd91f` | the transcript reading path streams, through one shared chunked line reader |
| 7 | `cf41d51` | the lineage test exercises AC 21's corpus neighbour and stops writing into `$TMPDIR` |
| 8 | `6dfbcb1` | the case reader takes a root; capture tests own a temporary one |
| 11 | `4f601d7` | `checkResultSchema.kind` is the four-kind literal union |
| 10 | `9368c6c` | the `Immutable` doc comment sits on `Immutable` again |
| 15 | `26321b6` | a fixture tree holding a symlink is refused before any provider call |
| docs | `4fb3278` | README and glossary for the two new user-facing behaviors |

### What the fixes changed in the design

**Findings 1, 2 and 9 have one cause and one fix.** Cleanup could not name the
file it was deleting. It took the alphabetically first new slug entry, so a
foreign file sorting before the provider's was copied into the attempt record
as evidence and then removed; and because the listing was read inside the `try`,
a `runClaude` that threw left the provider's transcript in
`~/.claude/projects` permanently.

The attempt now names its own session before the call: the fork's uuid when
resuming, `--session-id <uuid>` otherwise, which is the same flag the stage path
already uses and which `claude --help` (2.1.258) documents. The file the attempt
owns is `<sessionId>.jsonl` under its slug, known before the call rather than
inferred from the directory after it. Cleanup removes that path and only that
path, on both the returning and the throwing path, then takes the slug with
`rmdir`.

**Decided autonomously: an entry the attempt cannot attribute is left alone, and
the slug directory it keeps is the signal.** The dispatch left this open.
Deleting it was never an option, and throwing from the `finally` would mask the
real failure of a failed attempt. `rmdir` refuses a non-empty directory, so a
file the attempt cannot account for keeps its slug directory rather than being
deleted with it, and the leftover directory is what a reader sees. What matters
more, and is now structural, is that such a file can no longer be *recorded*:
the transcript is identified by a session id the harness chose, so a planted
file is never evidence regardless of where it sorts.

**Decided autonomously: `sessionCaseArgs` emits `--session-id` for a session
with no transcript.** AC 17 pins the flag set and forbids
`--no-session-persistence` and `--json-schema`; it says nothing about
`--session-id`, and persistence stays on. Not verified against the provider,
because this dispatch makes no paid call — see "What was not verified" below.

**Finding 4 is fixed at the boundary and made unrepresentable.** `reply` is
absent exactly when the outcome is `NO_REPLY`, and the record schema refuses a
`NO_REPLY` record carrying a reply or a check result, and a checked record
missing either. A session that produced no reply can no longer be written down
as one that passed its checks.

### Mutations run to prove the new tests

The dispatch asked for findings 1, 2 and 6; findings 4, 5 and 7 got the same
treatment.

- **Finding 1.** Renaming the old fixture to `0oao-was-here.jsonl` failed the
  old test, confirming its outcome depended on the filename's sort position.
  The new tests plant `0000-unrelated-live.jsonl` and `zzzz-unrelated-live.jsonl`,
  bracketing the provider's file, so no sort direction can pass. Restoring the
  sort-order pick fails both "keeps every file another session planted" and
  "records the transcript the provider's own session wrote".
- **Finding 2.** Moving cleanup off the failure path, so it runs only after a
  successful record, fails "leaves nothing behind when the provider writes its
  transcript and then throws".
- **Finding 6.** Replacing `sourceLines` with `Bun.file(path).text()` leaves the
  observer uncalled: measured `widest` 0 against `sourceBytes` 1649490, so the
  old `widest < sourceBytes` assertion **passed** against a non-streaming
  subject. The new assertion fails it on the observation count.
- **Finding 4.** Restoring `envelope.result ?? ""` fails both new attempt tests.
- **Finding 5.** Replacing `parseTranscriptFile`'s body with a whole-file read
  fails its streaming test on the observation count.
- **Finding 7.** Hashing the corpus file's directory instead of its declared
  digest fails the new corpus-neighbour test and only that test, which the
  replaced test could not have detected at all.

### Observed directly

- The finding 15 refusal, through the executable. A temporary case declaring a
  fixture with `escape.md -> /etc/hosts`:
  `bun rehearsal.ts run --case zz-symlink-probe --model haiku --effort low
  --session-budget-usd 0.2` exits **3** with
  `Fixture entry escape.md is a symlink, which would lead out of the attempt
  directory`, and no provider call. The probe case was deleted, never committed.
- Finding 3 before and after: `resolveCorpusFile("skills/../../../../etc/passwd")`
  returned `/etc/passwd` and `resolveCorpusFile("agents/../../.ssh/id_rsa")`
  returned `/Users/joaofnds/.ssh/id_rsa`; both now refuse naming the path.
- Finding 15's mechanism: a `cp` with `recursive` leaves the copied entry a
  symlink (`lstat().isSymbolicLink()` true) reading `/etc/hosts` from inside the
  attempt directory.
- Finding 7's leak: `beside.md` was present in the shared temp root from an
  earlier suite run, was removed, and no longer reappears after a full run.
- Finding 8's harm: with a `zz-capture-probe` directory present in `cases/`,
  `listCases()` returns `audit-log, smoke, zz-capture-probe`.
- The fork's byte fidelity, after making it stream: a source ending with a
  newline, one ending without, and an empty one each fork to bytes identical to
  the source except the session id.

### What was not verified

- **That the provider honors `--session-id` for a fresh session in `-p` mode.**
  The flag is documented in `claude --help` on 2.1.258 and the stage path
  already uses it, but this dispatch made no paid call, so it has not been sent
  for a session case. This is the one thing the next paid run must watch: if the
  provider ignored it and named the session itself, the attempt would copy an
  empty transcript and leave the real one behind, which the `rmdir` would then
  surface as a slug directory that survives. The cheap check is the smoke case.
- `--settings` with `outputStyle` on `--resume`, unchanged from the Build
  handoff and still unobserved.
- The `files-read` check against a real transcript, unchanged.

### Findings recorded without a code change

- **12.** `SessionRunConfig` carries `judgeModel` and `judgeEffort`, which a
  session case has no judge for. Inconsistent with decision 2's reasoning, no
  behavioral defect. Removing them means splitting the shared session-knob
  parsing, which is a change to the pipeline path this dispatch was not asked to
  touch.
- **13.** `run --help` still describes only the pipeline case and lists
  `--target` and `--pipeline` without saying a session case refuses them. The
  refusal itself works (AC 23).
- **14.** `rehearsal.ts:63-67` reads `case capture`'s two flags with a
  hand-written scan rather than through `parseCommandLine`, a second home for
  flag spellings where the glossary says there is one. Safe today because
  undeclared flags are rejected first.
- **17.** The confirmation record change is correct in both directions for every
  record on disk, and the rewritten success rule is logically identical for
  stage and pipeline. The caveat: a record written now with `mode: "session"` at
  schemaVersion 1 would fail a reader built before this change, so "readable in
  both directions" holds for records on disk, not for older readers. Costs
  nothing today because there is one local executable.
- **16, and a disagreement with it.** The finding says the session run-command
  suite holds two near-duplicate tests where the second asserts strictly less
  than the first. Read again this dispatch, they assert different things: the
  first checks the returned record's fields, the second reads the file back off
  disk and parses it with `parseSessionAttemptRecord`, which is AC 18's "parses
  with the schema that wrote it" and is the only coverage of the write path.
  Deleting the second would drop that. Left as is, and flagged here rather than
  acted on, because removing real coverage on a contested reading is the more
  expensive mistake.

### Refactor pass

Three structural opportunities the fixes exposed, each taken in the commit that
exposed it rather than as a separate pass:

- The chunked line reader had one copy in `session-capture.ts` and was about to
  get a second in `transcript.ts`. It became `file-lines.ts`, and the fork uses
  it too, so three readers of multi-megabyte session files share one
  implementation of how a file becomes lines.
- `buildAttemptRecord` built its optional keys through nested ternaries that
  doubled with each new optional field. It assembles the record in statements
  now, which is also what the `no-conditional-empty-object-spread` guard asks
  for.
- `case-command.ts` had its own `declarationFile` duplicating the path
  `case.ts` knows how to build. It calls `caseDeclarationPath` now.

### Still open for the reviewer

Nothing from this pass. The session-naming change is the one that wants a paid
observation before the card leaves Review; every other fix is proven by a test
that fails against the behavior it replaced.
<!-- SECTION:NOTES:END -->
