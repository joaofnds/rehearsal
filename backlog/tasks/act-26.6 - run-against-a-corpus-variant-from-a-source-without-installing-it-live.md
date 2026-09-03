---
id: ACT-26.6
title: run against a corpus variant from a source without installing it live
status: Review
assignee:
  - '@claude'
created_date: '2026-09-02 15:14'
updated_date: '2026-09-03 00:37'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 27008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today the corpus under test is the live install: CLAUDE.md at the control root plus ~/.claude/skills. Testing a dotfiles edit means chezmoi apply, which takes effect in every running session; the workarounds (unmanaged variant files, per-session --settings and --agents overrides) cover styles and agents but not skills or CLAUDE.md. Add --corpus <source> to run and replay: a directory holding the corpus layout, or a chezmoi source at a git ref, rendered into a scratch destination. The run snapshots that corpus, records it as the corpus snapshot in lineage, and gives the session a config that carries it without touching the live one. Absent --corpus, today's behavior stands. rehearsal stale --corpus <source> (ACT-26.2) reads the same source.

Gap 3 in doc-1. The config question is settled: João's intent stands, and Shape replaced the mechanism it named after observing that a copied config carries no login state. The session runs with the live config and the files under test are overlaid inside the attempt directory. Shape also observed that chezmoi renders a non-HEAD ref into a scratch destination, the fact the card called inferred.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 resolveCorpusSource(undefined) returns the live install layout and resolveCorpusSource("<dir>") returns that directory, both as a resolved corpus source carrying its kind and its root: one test asserts both without touching the network or the provider
- [x] #2 A directory corpus source whose root does not exist, or which holds none of the four corpus layout entries, is refused naming the root before any provider call
- [x] #3 resolveCorpusFile resolves a corpus layout path against a resolved corpus source rather than the live install: given a directory source, "output-styles/brief.md" resolves under that directory, and a path with a .. segment is still refused naming the path
- [x] #4 hashCorpusFiles over a directory source returns the digests of that directory's bytes, and a test asserts those digests differ from the live install's for the same layout paths when the directory's bytes differ
- [x] #5 A chezmoi corpus source parses from "chezmoi:<ref>" into a value carrying that ref, and "chezmoi:" with no ref, or a source string naming neither an existing directory nor the chezmoi scheme, exits 2 naming the source
- [x] #6 Rendering a chezmoi source runs git -C <dotfiles> archive <ref> piped to tar -x into a scratch source directory, then chezmoi apply --source <that> --destination <scratch> --exclude encrypted,scripts with no --verbose: a test with a fake command runner asserts that exact argument sequence, including both exclusions
- [x] #7 A rendered chezmoi tree maps onto corpus layout by reading .agents/skills/<name>/ as skills/<name>/, .claude/output-styles/<name>.md as output-styles/<name>.md, and .agents/agents/<name>.md as agents/<name>.md: a test over a fixture tree asserts the mapping and asserts that a .claude/skills symlink in that fixture is never followed
- [x] #8 A chezmoi corpus source records the ref's resolved commit sha in the snapshot, so two runs at the same ref are comparable and a moved ref is visible
- [x] #9 A chezmoi corpus source carries no project CLAUDE.md: the snapshot's CLAUDE.md is the control root's, and a test asserts that byte identity
- [x] #10 The snapshot directory is the single place corpus bytes are read from for hashing and installing: snapshotSessionCorpus copies the resolved source's four kinds into it and hashCorpusFiles then reads only that directory, asserted by a test that mutates the source after the snapshot and sees the digests unchanged
- [x] #11 Installing a session corpus snapshot into an attempt directory writes <attempt>/.claude/output-styles/<name>.md and <attempt>/.claude/agents/<name>.md from the snapshot, and a test asserts the bytes match the snapshot's
- [x] #12 A session attempt whose corpus declares an output style runs with --settings carrying {"outputStyle":"<name>"} merged over the case's declared settings, and a test asserts the case's own settings keys survive the merge
- [x] #13 Skills are delivered by the mechanism ACT-28 settles, not by the attempt-directory overlay: until ACT-28 lands, a session case that declares a skills/ corpus file is refused naming the skill and ACT-28, and a stage run with --corpus is refused naming ACT-28, so no run reports a skill result the harness cannot deliver. A source whose undeclared skill bytes differ is not refused, because an undeclared file is never reported; the broader guarantee that any changed skill bytes are refused waits on ACT-28
- [x] #14 rehearsal run --help and rehearsal replay --help each list --corpus with its source syntax, and the flag is declared once in the commands table
- [x] #15 The lineage of a session attempt changes when --corpus names a source whose declared corpus bytes differ, and is unchanged when two different sources resolve to identical bytes: one test asserts both
- [x] #16 Absent --corpus, a session attempt's recorded corpusFiles and lineage are byte-identical to what the same case recorded before this card: a test asserts the lineage string is unchanged
- [x] #17 rehearsal run --case smoke --corpus <dir> --model haiku --effort low --session-budget-usd 0.2 exits 0 and records a corpus snapshot whose output-styles/brief.md digest equals the marker file's, while chezmoi diff stays empty and the live ~/.claude/output-styles/brief.md digest is unchanged before and after (the paid observation, capped at USD 1)
- [x] #18 rehearsal run --case smoke --corpus chezmoi:HEAD on that same case records a corpus snapshot whose output-styles/brief.md digest equals the live style's, taken in the same paid observation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decided 2026-09-02: the session's config is a copy of the live config with only the files under test replaced, never a scratch config. Shape observes whether a copied config carries login state.

## Goal

`run` and `replay` gain `--corpus <source>`: a directory in corpus layout or a
chezmoi source at a git ref, resolved to one snapshot directory, hashed into
lineage and installed into the attempt the harness already owns, so a corpus
edit is measured without `chezmoi apply` touching any running session.

## The mechanism under João's decision, replaced

João's decision of 2026-09-02 stands in its intent: the session sees the live
hooks, memory, and MCP, only the files under test are replaced, and nothing live
is touched. The mechanism he named, a copy of the config directory, cannot serve
it. Verified by the orchestrator this session: copying `settings.json` and
`.claude.json` into a scratch `CLAUDE_CONFIG_DIR` and running `claude -p` there
returns "Not logged in · Please run /login". Login lives in the keychain, not the
config directory, so a copied config needs an interactive login per copy and no
autonomous run can have one.

The replacement serves the same intent by a different route: the session runs
with the live config, so hooks, memory, and MCP are the real ones, and the files
under test are placed as project-level files inside the attempt directory, which
the harness creates, owns, and deletes, and which no live session reads. This is
appended to doc-1's decided section with the observation, so the decision's
history reads honestly: the intent is João's, the mechanism is not.

## The three paid probes, and what they showed

Run 2026-09-03 from a temporary directory created and deleted for them, each at
`--model haiku --effort low --max-budget-usd 0.10`. Each wrote a project-level
file carrying a marker sentence its live user-level twin does not have, so the
reply proves which file was loaded. Live corpus verified unchanged after: the
live `brief.md`, `reviewer.md`, and `style/SKILL.md` hold no marker token.

| # | probe | command | result | cost USD |
|---|---|---|---|---|
| 1 | project skill shadows user skill | `claude -p "Read the style skill and reply with only its marker sentence token..." --tools "Read,Glob,Grep,Skill"` in a cwd holding `.claude/skills/style/SKILL.md` with `PROBE-SKILL-MARKER-ZQX7` | `NO-MARKER` — **does not shadow** | 0.0280 |
| 1b | is the file even there | `claude -p "Find the SKILL.md file for the skill named style. Reply with only the absolute path... and the marker sentence token"` | `/private/tmp/<probe>/.claude/skills/style/SKILL.md PROBE-SKILL-MARKER-ZQX7` — file present and readable | 0.0140 |
| 1c | which one the Skill tool loads | `claude -p "Invoke the style skill using the Skill tool. Then reply with only the marker sentence token that the skill content you received contains..."` | `NO-MARKER` — the Skill tool resolved the user-level definition | 0.0119 |
| 2 | project output style shadows user style | `claude -p "Reply with only the output style marker sentence token..." --tools "" --settings '{"outputStyle":"brief"}'` with `.claude/output-styles/brief.md` carrying `PROBE-STYLE-MARKER-VKR3` | `PROBE-STYLE-MARKER-VKR3` — **shadows** | 0.0180 |
| 3 | project agent shadows user agent | `claude -p "Dispatch the reviewer agent in the foreground with the message: Reply with only your agent definition marker sentence token..." --tools "Agent,Read,Glob,Grep"` with `.claude/agents/reviewer.md` carrying `PROBE-AGENT-MARKER-JWD9` | `PROBE-AGENT-MARKER-JWD9`, `subagent_stats.spawned: 1` — **shadows** | 0.0367 |

A fourth call (USD 0.0184) asked the session to list its available skills and is
not evidence: it ran with `--tools ""`, so the Skill tool was absent and the
reply only says so.

Total paid at Shape: **USD 0.1270**, against the USD 0.40 cap.

What this settles for the design: output styles and agent definitions use the
attempt-directory overlay, as recommended. Skills cannot, and the failure is not
this card's to fix.

## The pre-existing defect the skill probe found: ACT-28

`installStageCorpusSnapshot` (`src/benchmark/checkpoint.ts:206`) copies the
frozen skill bytes to `<worktree>/.claude/skills/<name>`, and
`pipeline-confirmation.ts:389` calls it before every stage session, on the ACT-5
assumption that a project-level skill shadows the same-named user-level one.
Probe 1 shows it does not, and probe 1b shows the file is present and readable,
so this is resolution, not installation. Every confirmation rep and every replay
that installs a corpus snapshot has been running the stage against whatever skill
was installed live at that moment while recording the frozen bytes in lineage.
Filed as **ACT-28**, a defect card, with the observation and both markers.

`claude --help` on 2.1.258 declares no `--skills` flag; `--plugin-dir <path>`
loads a plugin directory and `--setting-sources user,project,local` selects which
settings files load. Which of these delivers frozen skill bytes is ACT-28's
question, not this card's.

## Unknowns, and how each was resolved

Every resolution cites a tool result from this dispatch or a file in the
repository.

1. **Whether a copied config carries login state.** Resolved by the
   orchestrator's observation, above: it does not. The mechanism is replaced.
2. **Whether a project-level skill shadows a user-level one.** Probes 1, 1b, 1c:
   no. ACT-28 filed; this card refuses a corpus source that changes skill bytes
   rather than reporting a result it cannot deliver.
3. **Whether a project-level output style shadows a user-level one, and whether
   `--settings` selects it.** Probe 2: yes to both, in one call.
4. **Whether a project-level agent definition shadows a user-level one.**
   Probe 3: yes, with a real subagent spawned.
5. **Whether `chezmoi apply` renders a non-HEAD ref into a scratch destination.**
   Observed this dispatch, the fact the card called inferred:
   `git -C ~/code/dotfiles archive HEAD~1 | tar -x -C <src>` then
   `chezmoi apply --source <src> --destination <dst> --exclude encrypted,scripts`
   completed in 2.7s with no prompt. The rendered
   `.claude/output-styles/brief.md` hashes to
   `9f1ffb5e30fbe4cdbe0535af8b1338719b59cb6911d4de9cd526271b55b2d24c`, equal to
   `git show HEAD~1:dot_claude/output-styles/brief.md`.
6. **Whether the ref actually selects content, or the render always yields live
   bytes.** `brief.md` is unchanged between HEAD~1 and HEAD, so it could not
   settle this on its own. The render at HEAD~1 carries
   `.claude/hooks/brief-pass.py`, which commit 73d14ee removed and the live
   `~/.claude/hooks` does not have, and its `settings.json` hashes to
   `5349593c...` against the live `901fffe6...`. The ref selects content.
7. **Whether the scratch render touched anything live.** `chezmoi diff` reported
   no file differences after the render, and the live `settings.json` still
   hashes to `901fffe6...`. The gpg lines on its stderr are decryption notices,
   not differences.
8. **What the rendered tree's corpus layout is.** Read directly:
   `.agents/skills/<name>/`, `.agents/agents/reviewer.md`, `.agents/AGENTS.md`,
   `.claude/output-styles/brief.md` are real files;
   `.claude/CLAUDE.md`, `.claude/skills`, and `.claude/agents` are symlinks into
   the live `/Users/joaofnds/.agents`. The mapping reads the `.agents` paths and
   never follows a `.claude/*` symlink, because following one would hash and
   install the live corpus while claiming to have rendered a ref.
9. **Where the resolver seam is.** `resolveCorpusFile(layoutPath)` in
   `src/benchmark/corpus-file.ts` is already the only place that knows where the
   corpus is installed, and its own comment names this card. It gains a resolved
   corpus source parameter; `hashCorpusFiles` passes it through. Nothing else
   moves.
10. **Whether `--corpus` needs a new config parser.** No. `parseSessionArgs`
    (`src/benchmark/config.ts:278`) and `parseArgs` both take flags through
    `flagValues`, and the flag is declared once in the `COMMANDS` table
    (`src/cli/commands.ts`), which is the single source of its name in help,
    parsing, and documentation.

## Decided autonomously

No reader was available for the shape skill's numbered list, so each of these was
settled here, under the dispatch's decision policy.

1. **Skills are refused, not silently ignored, until ACT-28.** A corpus source
   whose skill bytes differ from the live install would be hashed into lineage
   and then not delivered, which records a measurement of a corpus the session
   never read. Refusing names the skill and ACT-28. Policy rule 5: the delivery
   mechanism for skills is named by the card but no current case needs it, and
   the smoke case under test declares an output style. Reason: a wrong number is
   worse than a missing one, and this card cannot fix ACT-28 without becoming it.
2. **`--corpus` resolves to a snapshot directory before any provider call, and
   nothing reads the source afterwards.** Policy rule 2, smallest coherent
   scope, and §5 parse-don't-validate: the source string is parsed once at the
   boundary into a resolved source, and the snapshot directory is the only thing
   the hashing and installing code sees, so that code cannot learn whether it
   came from a directory or a chezmoi ref.
3. **The chezmoi source records the ref's resolved commit, not the ref string.**
   `chezmoi:HEAD` names different bytes on different days. Recording the resolved
   sha keeps records readable in both directions (policy rule 4) and makes two
   runs at the same ref comparable.
4. **The scratch render is deleted after the snapshot is taken.** It is the whole
   home layout, about twenty entries, of which four kinds are read. Keeping it
   would leave a copy of João's home tree in `$TMPDIR` after every run.
5. **No `--corpus` on `compare`.** A comparison executes no session and reads the
   corpus snapshot already recorded in its evidence. Policy rule 5.
6. **The output style is selected with `--settings '{"outputStyle":"<name>"}'`
   merged over the case's declared settings, rather than replacing them.** Probe
   2 verified this selects the project-level file. A replace would silently drop
   a case's own settings overlay, which ACT-26.5's AC 17 records as declared
   behavior.

## Not built, and why

- **A `CLAUDE_CONFIG_DIR` copy mode.** Needs an interactive login per copy;
  unavailable to an autonomous run. Trigger: João logs a persistent scratch
  config in once, after which the copy carries its credentials.
- **Rules directories, memory, MCP, or hooks under test.** No case declares one,
  and the corpus layout settled in the glossary has four kinds. Trigger: a case
  that declares one of them as a corpus file.
- **Delivering skills from a corpus source.** ACT-28 owns the mechanism.
  Trigger: ACT-28 lands, at which point criterion 13's refusal becomes a
  delivery and the refusal test becomes its inverse.
- **`--corpus` on `stale`.** ACT-26.2 owns that command and reads the same
  resolver; this card makes the resolver its own module so that it can.

## Implementation plan

Only the parts likely to be revisited are planned; the rest is mechanical.

1. **`src/benchmark/corpus-source.ts`, new.** Parses a `--corpus` string into a
   `ResolvedCorpusSource` discriminated on kind (`live`, `directory`,
   `chezmoi`), each carrying the root the layout is read from and, for chezmoi,
   the resolved commit. Its own module because ACT-26.2's `stale --corpus` reads
   it too. The chezmoi render takes an injected command runner, as every paid or
   external boundary in this repository already does, so its argument sequence is
   asserted by a test with a fake and no test ever runs chezmoi.
2. **`corpus-file.ts` gains the source parameter.** `resolveCorpusFile(source,
   layoutPath)` and `hashCorpusFiles(source, layoutPaths)`. The confinement check
   stays exactly as it is; only the root it confines to changes. This is the seam
   ACT-26.5 left, and its comment says so.
3. **Snapshot and install.** A session snapshot copies the four kinds from the
   resolved source into the run's snapshot directory; the install writes
   `output-styles/` and `agents/` into `<attempt>/.claude/`. `captureStageCorpus`
   and `snapshotStageCorpus` take a resolved source instead of search roots, so
   the pipeline path and the session path read a corpus the same way.
4. **CLI.** One `--corpus` flag declared in the `COMMANDS` table for `run` and
   `replay`, threaded through `parseSessionArgs` and `parseArgs` into the
   existing configs.

## The first test to write

`src/benchmark/corpus-source.test.ts`: resolving a directory source whose root
holds `output-styles/brief.md` returns a resolved source of kind `directory`
rooted there, and `resolveCorpusFile` against it returns that file's path, while
the same layout path against the live source still returns
`~/.claude/output-styles/brief.md`. It fails now because `resolveCorpusFile`
takes no source, and it is the smallest step that moves the seam ACT-26.5 left.

## Build handoff

### What changed

- **`src/benchmark/corpus-source.ts`, new.** Parses `--corpus` once at the
  boundary into a `ResolvedCorpusSource` discriminated on kind (`live`,
  `directory`, `chezmoi`), each carrying the root a layout path lands under.
  The chezmoi render takes an injected command runner, so its argument sequence
  is asserted with a fake and no test runs chezmoi. `corpusLayoutEntries` maps a
  source tree onto corpus layout and is where a source stops mattering.
- **`src/benchmark/session-corpus.ts`, new.** `snapshotSessionCorpus` copies the
  resolved source into one snapshot directory under the attempt record;
  `installSessionCorpusSnapshot` writes its `output-styles/` and `agents/` into
  `<attempt>/.claude/`; `snapshotStyleName` names the style the attempt selects.
- **`corpus-file.ts` takes a `CorpusRoot`** rather than knowing the install. Both
  a resolved source and a snapshot satisfy it. The confinement check is
  unchanged; only the root it confines to moved.
- **`session-attempt.ts`** installs the overlay into the attempt directory it
  already owns and merges `{"outputStyle":"<name>"}` over the case declared
  settings rather than replacing them.
- **CLI.** `--corpus` declared once in `COMMANDS` and shared by `run` and
  `replay`; threaded through `parseArgs`, `parseSessionArgs`, `parseReplayArgs`.
- **`file-presence.ts`, new (refactor pass).** One `statIfExists`/`pathExists`,
  taken from `checkpoint.ts`, where only ENOENT reads as absent.
- **`cases/smoke/case.json`** declares `output-styles/brief.md`, so a corpus
  variant has something to change.

### What became possible but is not wired up

- **`stale --corpus` (ACT-26.2)** reads `resolveCorpusSource` as its own module,
  as planned. Nothing calls it from there yet.
- **The pipeline and stage-replay paths are unchanged.** `captureStageCorpus` and
  `snapshotStageCorpus` still take skill search roots; the card planned to give
  them a resolved source, but a stage corpus is entirely skills and those cannot
  be delivered until ACT-28, so unifying now would build for a caller that
  cannot exist. `run` and `replay` refuse `--corpus` naming ACT-28
  (`refuseStageCorpus`, `src/cli/interactive-stdin.ts`). Recorded on ACT-28 with
  the target shape.
- **Callers still on the old path:** every pipeline stage. There is no session
  confirmation group yet (ACT-26.5 left that refused), so `--corpus --confirm`
  on a session case still hits that refusal.

### What was observed, and how

Three paid runs, total **USD 0.052625**, all with `--model haiku --effort low
--session-budget-usd 0.2`.

| what | command | result | cost USD |
|---|---|---|---|
| AC 17, directory corpus | `rehearsal run --case smoke --corpus <marker dir> --json` | exit 0; snapshot digest `ec8ec541...` = the marker file exactly; both checks PASS | 0.017865 |
| AC 18, chezmoi corpus | `rehearsal run --case smoke --corpus chezmoi:HEAD --json` | exit 0; snapshot digest `9f1ffb5e...` = the live style exactly; lineage `7d089f40...` differs from the directory run`s `3ae70b78...` | 0.017837 |
| AC 17 re-verified after the last two commits | same as row 1 | digest and lineage identical to row 1 | 0.016923 |

**The overlay reaches the session, which Shape had not verified inside an
attempt directory.** The attempt transcript records
`{"type": "output_style", "style": "brief"}` with
`cwd: /private/var/.../rehearsal-attempt-juGgUg`, so the session ran in the
attempt directory holding the overlay and was given the style the snapshot
delivered.

**Nothing live moved.** `~/.claude/output-styles/brief.md` hashed
`9f1ffb5e30fbe4cdbe0535af8b1338719b59cb6911d4de9cd526271b55b2d24c` before the
first run and after the last; `chezmoi diff --exclude encrypted,scripts` was
empty before and after every one. The marker corpus directory and every scratch
render were deleted; `$TMPDIR` holds no `rehearsal-chezmoi-*` entry.

Also observed directly: `run --help` and `replay --help` both print the
`--corpus` line (AC 14); `chezmoi:` with no ref exits **2**, a directory that
does not exist exits **2**, and `--corpus` on the audit-log pipeline case exits
**3** naming ACT-28.

Full check, exit codes captured with `; echo $?`: `bun run typecheck` 0,
`bun run lint` 0, `bun run fmt:check` 0, `bun test` 741 pass 0 fail.

### What was not verified

- **A chezmoi ref other than HEAD end to end.** Only `chezmoi:HEAD` was run
  paid. Shape verified `HEAD~1` renders and selects real content, and the ref is
  a passthrough argument, but no attempt was recorded at a non-HEAD ref.
- **An agent definition delivered through the overlay.** No case declares one,
  so the install path for `agents/` is covered by unit test only.
- **`--corpus` on `replay` beyond the refusal.** Since it always refuses, only
  the refusal was observed.
- **A corpus source over 20 entries or a large skill tree.** The snapshot copy is
  unbounded; no case is near that size.

### Defects met on the way

- **The chezmoi render leaked.** Two renders, seventeen entries of João`s home
  tree each, were left in `$TMPDIR`. The card`s autonomous decision 4 required
  deleting them. Fixed in `4b604c1`, with a test, and on a failed apply too.
- **The declared-skill refusal was too broad.** Keyed on every skill the source
  carried, it made `chezmoi:<ref>` permanently unusable: the first AC 18 run
  exited 3 on `skills/absorb`, which no case reads. Refusing on what the *case
  declares* is what decision 1 actually protects, since only a declared file is
  reported. Fixed in `4b604c1`.
- **Unparseable `--corpus` exited 3.** The exit codes reserve 3 for a refused
  precondition and 2 for an unparseable value. Fixed in `2ee8a23`.
- **Filed, not fixed: ACT-29.** The test suite leaks over 1500 temporary
  directories per run (817 `rehearsal-attempt-record`, 817
  `rehearsal-attempt-projects`, 676 `rehearsal-projects`, and more). Pre-existing
  and far outside this card; `TestResources` already exists to fix it. My own new
  leak was fixed in place.

### Independent review is due

Yes. The change moves a security-relevant boundary (`resolveCorpusFile`'s
confinement now confines to a caller-supplied root), runs shell commands built
by string interpolation (`renderChezmoi`'s `sh -c`), and deletes directories it
computed (`discardRender`). Each deserves a second reader.

### One more defect, found in the refactor pass: shell injection

Writing the handoff's "independent review is due" line surfaced it: the chezmoi
render interpolated `dotfilesDirectory`, `ref`, and `sourceDirectory` into an
`sh -c` string unquoted, and `ref` is a `--corpus` flag value. A red test
confirmed it: `--corpus "chezmoi:HEAD; touch /tmp/pwned"` produced
`git -C /dotfiles archive HEAD; touch /tmp/pwned | tar -x -C ...`, which runs
`touch` as a second command. AC 6 requires the pipe, so the shell stays; every
interpolated value is now single-quoted.

Verified against a real `sh`, not by reading the code: seven values carrying
`;`, `&&`, `$()`, backticks, and embedded single quotes each round-tripped
through `sh -c "printf %s <quoted>"` to their exact original bytes, and the
probe's `touch` never ran. Fixed in `7d67447`. `chezmoi:HEAD` re-run after the
change: exit 0, digest `9f1ffb5e...` and lineage `7d089f40...` unchanged from
the earlier chezmoi run, live corpus untouched.

### Paid spend on this card

Four runs, **USD 0.069510** total, against the USD 1.00 cap:

- 0.017865 AC 17, directory corpus
- 0.017837 AC 18, chezmoi corpus
- 0.016923 AC 17 re-verified after the declared-skill and render-cleanup fixes
- 0.016885 AC 18 re-verified after the shell-quoting fix

Live corpus hashed `9f1ffb5e30fbe4cdbe0535af8b1338719b59cb6911d4de9cd526271b55b2d24c`
before the first and after the last, and `chezmoi diff --exclude
encrypted,scripts` was empty at every check.

### Final check

`bun run typecheck` 0, `bun run lint` 0, `bun run fmt:check` 0,
`bun test` 742 pass 0 fail. Exit codes captured with `; echo $?`.

## Review fixes, 2026-09-03

Ten findings from the review, each in its own commit, no paid provider call:
spend for this dispatch **USD 0.00**. Every fix is pinned by a test that fails
against the behavior it replaces; the mutation that proves each is named below.

| # | finding | commit | proof |
|---|---|---|---|
| 1 | option injection through the chezmoi ref | `c62194a` | probe below |
| 2 | pipeline reported tar's exit code | `34ad797` | real shell, below |
| 3 | attempt ran an undeclared corpus | `ed82ce1` | end-to-end run, below |
| 4 | refused run leaked the render | `a69c8df` | discard moved out of `finally` fails it |
| 5 | snapshot followed symlinks | `3f59d15` | dropping `refuseSymlinks` fails both tests |
| 6 | recorded commit unvalidated | `85e84b3` | four non-sha values, all refused |
| 7 | criterion 8 persisted nothing | `bc6e9cc` | record read back off disk |
| 8 | security test passed an exploitable impl | `2ebfe36` | naive quoting fails four tests |
| 9 | no test pinned selection or overlay scope | in `ed82ce1` | three mutations, each caught |
| 10 | criterion 13 disagreed with the code | `99eaabc` | criterion text now matches |
| 14 | dead export | `edec2dd` | nothing imported it |

Docs followed in `859e196`; one refactor-pass commit, `538cda5`.

### Finding 1, and what the probe now shows

Reproduced first, to see the failure directly:
`git -C ~/code/dotfiles rev-parse '--output=/tmp/.../VICTIM.txt'` exits **0** and
echoes the string back, so the guard passed it; the piped archive then truncated
a real 33-byte file to **0 bytes** and the pipeline still exited **0**.

`git archive` parses its positional ref as an option, so quoting could never
reach this: the injection is at argv. A ref opening with `-` is refused before
either command runs, and the resolve is now
`git rev-parse --verify --end-of-options <ref>^{commit}`, so a ref naming no
commit is rejected rather than resolved to itself.

The orchestrator's exact probe, run against a file created under a temporary
directory: refused naming the ref, and the victim survived at **33 bytes** with
its contents intact.

### Finding 2, in a real shell

`set -o pipefail` was chosen over writing the archive to a temporary file,
because criterion 6 asserts the pipe and the temp-file route would remove it.
`/bin/sh` here is bash and honors it. Observed on the same failing archive:

- without pipefail: **exit 0**
- with pipefail: **exit 128**

### Finding 3, observed end to end

A session attempt run through `runSessionDebugAttempt` with a fake provider,
against the reviewer's exact corpus (declared `brief.md`, undeclared
`aardvark.md` and `agents/rogue.md`):

- `--settings` carried `{"outputStyle":"brief"}`, not `aardvark`
- the only file the session saw was `.claude/output-styles/brief.md`; neither
  `aardvark.md` nor `rogue.md` reached the attempt directory
- the recorded digest `39ef6efe...` equals the declared marker's bytes exactly
- `corpusOrigin` on disk was `{"kind":"directory","source":"..."}`

The snapshot now carries the case's declared paths, and the copy, the overlay,
and the style selection each read that rather than the directory listing. The
`ResolvedCorpusSource` to `SessionCorpusSnapshot` seam is untouched, as the
reviewer asked.

### Finding 11, the orchestrator's observation of criteria 17 and 18

Recorded here because the reviewer could not verify them without a paid run and
the orchestrator has since observed both directly: a directory corpus carrying a
marker style recorded the digest `600426af0d6bd18e` matching the marker file
exactly, read from the run's own directory, with the live style file unchanged
and `chezmoi diff` clean.

### Findings 12 and 13, no change

Both were recorded as notes, not defects: `withCorpus` in `config.ts` performs no
cast, and `resolveCorpusFile`'s confinement of `CLAUDE.md` for non-live sources
is an improvement whose trustworthy root holds.

## Decided autonomously, 2026-09-03

No reader was available, so each of these was settled under the dispatch's
decision policy.

1. **`set -o pipefail` rather than an intermediate archive file.** Criterion 6
   asserts the archive is piped into tar, and the temp-file route the review
   offered as an alternative would have removed the pipe the criterion names.
   Reason: a settled criterion is a constraint, and pipefail closes the defect
   without touching it. Cost: a strict POSIX `sh` would fail on the `set` itself,
   which is a loud failure rather than the silent one being fixed.
2. **A leading-dash refusal rather than a ref allowlist.** Refusing every ref
   opening with `-` is the smallest rule that closes the argv layer, and it
   rejects nothing a git ref may be named: `git branch -- '-foo'` answers
   `fatal: '-foo' is not a valid branch name`, checked this dispatch in a
   throwaway repository, while `foo-bar` and `feature/x` pass
   `check-ref-format`. An allowlist would have refused legitimate refs carrying
   `/`, `~`, `^`, and `@{...}`.
3. **The snapshot copy is scoped to declared paths, not only the install.** The
   review named the install and the selection; scoping the copy too means the
   snapshot directory itself cannot carry bytes no case declared, so nothing
   downstream can reach them by any route. Reason: the snapshot is the single
   place bytes are read from, and a guard the structure enforces beats one each
   reader must remember.
4. **A symlinked corpus entry is refused rather than resolved and confined.**
   This follows the precedent ACT-26.5 set for a fixture holding a symlink, which
   the review named, and it needs no judgment about which link targets are
   acceptable. The `CHEZMOI_LAYOUT` comment no longer claims a defense it never
   provided: it is a mapping, and the refusal is the defense.
5. **Criterion 8 kept, with the origin persisted, rather than dropped as
   speculative.** The criterion's purpose (two runs at one ref comparable, a
   moved ref visible) is real and cheap to satisfy, and dropping it would have
   left the glossary's corpus snapshot origin term describing nothing. The field
   is optional and its absence means the live install, which is what every record
   written before it read, so old records still parse: records readable in both
   directions, per the policy.

### Final check, this dispatch

`bun run typecheck` 0, `bun run lint` 0, `bun run fmt:check` 0,
`bun test` **779 pass 0 fail**. Exit codes captured with `; echo $?`.
<!-- SECTION:NOTES:END -->
