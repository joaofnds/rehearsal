---
id: ACT-26.5
title: >-
  add the session case kind: a prompt or a resumed transcript with deterministic
  checks
status: Build
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 22:49'
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
- [ ] #1 cases/smoke/case.json declares kind session with prompt "Reply with the single word OK.", tools [], no transcript, and two checks (word-band max 1 over the reply, tool-calls max 0 over the transcript); rehearsal case show smoke --json exits 0 and prints it back through the same schema that loaded it
- [ ] #2 A session declaration that names a fixture path outside its case directory (leading slash or .. segment) is refused at load with an error naming that path, and a session declaration carrying a pipeline field is refused naming the unrecognized key
- [ ] #3 loadCase("smoke") returns a value whose kind is session carrying prompt, tools, and checks, and loadCase("audit-log") returns a value whose kind is pipeline carrying its task, brief, rubrics, and pipeline: one test asserts both, and the audit-log assertions are the ones ACT-26.4 already recorded, unchanged
- [ ] #4 The word-band check reports PASS when the reply's word count is inside [min, max] and FAIL naming the count and the band when it is outside; a table-driven test covers a reply below min, at min, at max, above max, and a band that declares only max
- [ ] #5 The forbidden-text check reports FAIL naming each declared string the reply contains and PASS when it contains none; the declared strings come from the case (an em dash and a backtick are case data, not constants in the check)
- [ ] #6 The tool-calls check counts tool_use records in the transcript and reports FAIL when the count is outside [min, max] or when a call names a tool outside the declared names, naming the offending tool; a transcript with zero tool_use records passes max 0
- [ ] #7 The files-read check reports PASS when every declared path appears as the file_path of a Read tool_use in the transcript and FAIL naming each declared path that does not
- [ ] #8 A check list result is successful when and only when every check passes: a test asserts one failing check among four passing ones makes the attempt unsuccessful and the record names which check failed
- [ ] #9 rehearsal case capture smoke --session <id-or-prefix> --cut 3 writes .benchmark-runs/cases/smoke/<file>.jsonl holding exactly lines [0,3) of the source session file, records file, sha256, sourceSession, and cut in cases/smoke/case.json, exits 0, and prints the updated declaration with --json
- [ ] #10 case capture streams the source file line by line: a test over a source larger than the capture buffer asserts the written prefix is byte-identical to its first cut lines and that the whole source is never held as one string
- [ ] #11 case capture --session <prefix> resolves a unique prefix to one session file and exits 3 naming both candidates when the prefix matches more than one, and exits 3 naming the prefix when it matches none
- [ ] #12 case capture --cut with an index of 0, a negative index, or an index past the source's line count exits 2 naming the index and the source's line count
- [ ] #13 An attempt runs in a fresh temporary directory the harness creates, seeded from the case's fixture/ tree when one is declared: a test with a fake runner asserts the working directory the runner received is not the control repository and not the case directory, and that it holds a copy of the fixture's files
- [ ] #14 A session case with a transcript forks it into ~/.claude/projects/<slug of the attempt directory's real path>/<fresh uuid>.jsonl with every occurrence of the source session id replaced by that uuid, and a test over a two-record fixture asserts the forked bytes differ from the source only in the session id
- [ ] #15 The slug of an attempt directory is its real path with every / replaced by -: a test asserts /private/tmp/x maps to -private-tmp-x and that a path given as /tmp/x on macOS resolves through its real path first
- [ ] #16 After an attempt the projects slug directory holds no file the attempt created: cleanup diffs the directory listing taken before the run against the listing after and removes only entries absent from the first, and a test with a file planted mid-run asserts that file survives
- [ ] #17 claudeArgs for a session case produces --tools "" for an empty declared tools list, --tools with the joined names otherwise, --settings with the declared settings JSON, --agents only when agents are declared, --output-format json, --max-budget-usd from the session budget, --model and --effort from the session knobs, --resume <uuid> when a transcript is declared and no --resume when none is, and never --no-session-persistence and never --json-schema
- [ ] #18 A session debug attempt writes one record carrying the case id, the reply, the path of the transcript copy under the attempt record, the provider call metrics, and one result per declared check; rehearsal run --case smoke --json prints exactly that record and it parses with the schema that wrote it
- [ ] #19 confirmationRepRecordSchema and confirmationGroupRecordSchema accept mode session at schemaVersion 1, with the check list as one stage entry and finalOutcome NOT_APPLICABLE, and a v1 record written before this card (mode stage or pipeline) still parses unchanged: a test asserts both
- [ ] #20 projectConfirmationCost for mode session is reps x one session at the session budget: a test asserts 3 reps at 0.2 USD projects 0.60 USD total, and rehearsal run --case smoke --confirm --reps 2 --yes prints that projection before any provider call
- [ ] #21 The lineage of a session attempt hashes the transcript digest, the fixture tree, the prompt, the tool and settings overlays, and the declared corpus files' bytes: a test asserts the key changes when a declared corpus file's bytes change and is unchanged when an undeclared file beside it changes
- [ ] #22 Corpus files declared in corpus layout paths resolve through one function to the live install (output-styles/<name>.md to ~/.claude/output-styles/, agents/<name>.md to ~/.claude/agents/, skills/<name>/... to ~/.claude/skills/, CLAUDE.md to the control root), and a declared corpus file that does not exist is refused before any provider call, naming the resolved path
- [ ] #23 rehearsal run --help lists the flags a session case uses and rehearsal --help lists case capture with its summary; running rehearsal run --case smoke --pipeline <path> exits 2 naming --pipeline as a flag a session case does not take
- [ ] #24 rehearsal run --case smoke --model haiku --effort low --session-budget-usd 0.2 exits 0, writes the attempt record with the reply, the transcript copy, the metrics, and a passing check list, and prints that record with --json (the paid observation, capped at USD 2)
- [ ] #25 A two-turn session captured at the cut after its first answer, run with the prompt "What was the codeword? Reply with only the codeword." and a forbidden-text check over the wrong word, passes: the resumed attempt names the codeword from the transcript prefix, and the projects directory holds no file the attempt created
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
<!-- SECTION:NOTES:END -->
