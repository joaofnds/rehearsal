---
id: doc-1
title: agent-cli-exploration
type: specification
created_date: '2026-09-02 15:12'
---


# An agent-drivable CLI for rehearsal

Exploration record for ACT-26 and its children. Direction from João, 2026-09-02:
agents that edit his instruction corpus keep writing their own evals as shell
scripts and prose; evals belong in rehearsal, so rehearsal needs a CLI agents can
use to set up cases, run them, and read the results, covering what a human does at
the terminal today.

## Who uses it, and for what

The user is a Claude Code session working a dotfiles card that edits a corpus
file: an output style, an agent definition, a skill, a rule, `CLAUDE.md`. Its job
is to show the edit helps, does not regress, and to record that on the card so a
later session can read it. João does the same work by hand and uses the same
commands.

The jobs, in the order a session meets them:

1. Define a case: freeze the inputs that reproduce the condition the edit is for
   (a transcript cut point, a prompt in a repository, a fixture plus a prompt, a
   pipeline checkpoint) and the judge that scores an attempt.
2. Run the case once, cheaply, against a corpus variant, and read the attempt:
   the reply or artifacts, the trajectory, the diff against the previous attempt.
3. Confirm across reps and compare baseline against candidate, paired, with cost.
4. Record the result where the card can cite it, under an ID a later session can
   retrieve.
5. Discover what exists: cases, runs, checkpoints, prior attempts, what an edit
   made stale.
6. Point the run at a corpus variant without installing it into the live config,
   because other sessions are running on the live config and an install takes
   effect in them mid-session.

## What agents built instead

Four bespoke harnesses in the last six weeks, all measuring the same corpus the
tool exists to measure.

| harness | setup | invocation | judge | reps | results | spend |
|---|---|---|---|---|---|---|
| dotfiles doc-3, headless probe (2026-08-31) | variant style files written unmanaged under `~/.claude/output-styles/` | `claude -p "<prompt>" --settings '{"outputStyle":...}'` in a real repo | eyeballed word count and shape against João's kept /brief rewrite | 1 to 3 | table in the doc | unrecorded |
| dotfiles doc-4, transcript replay (2026-09-01) | `fork.py` copies a real session file truncated before the fired reply, rewrites the session id | `claude -p "Tools are unavailable now. Write your reply" --resume <uuid> --tools "" --settings ...` | word count against the accepted band; content read by eye | 1 to 2 per cell, 14 variants | table in the doc; raw output in `/tmp/replay/` | about 22 USD |
| clean-room brief-split (2026-09-02) | same fork, `--tools "Agent,Read"`, `--agents` override for agent variants | same | deterministic from the transcript: agent dispatched with Request and Draft, sent equals return minus whole sentences, no em dash, no backtick, questions subset of draft, word band | 1 to 3 per cell | `MEASUREMENTS.md`, card notes | about 52 USD plus 15 USD |
| dotfiles instructions-reviewer known-answer cases (2026-07-25 to 08-21, deleted with the corpus swap at 5053913) | fixture tree with planted defects, answer key kept outside the tree the agent reads | invoke the agent with the case's verbatim prompt | recall and precision against the key, severity rank, decoy not flagged; process scored from the transcript in a second pass | 1 | one markdown file per run, a runs table in the README | unrecorded |

What they had in common: frozen inputs by hand, an invocation line copied between
docs, a judge written as prose or done by eye, results in markdown that no later
run can be compared against, and no control arm. Every one of them was thrown
away or is about to be (DOT-18 points at rehearsal instead of building a script).
Single reps swung 30 to 120 words on the same turn, so every reading was taken on
evidence the vision says is not a score.

## Why rehearsal was not used

Each gap is verified against the code at bbab19a unless marked.

1. There is one case, and it is hardcoded. The task, brief, final rubric, and stage
   rubrics are files at the control root; the target is one flag. A second task,
   or a case that is not a pipeline against a NestJS repository, has nowhere to
   go. ACT-25 is the first such case and is waiting on exactly this.
2. The only case kind is a pipeline stage invoking a skill in a target repository.
   Three of the four harnesses above measured something else: a reply turn resumed
   from a real transcript, and an agent's review of a fixture. The corpus files
   agents actually edit (styles, agent definitions, rules) are not on the stage
   graph, so the invalidation map and lineage cannot see them either.
3. The corpus under test is the live install: `CLAUDE.md` at the control root
   plus `~/.claude/skills`. Testing a dotfiles edit means `chezmoi apply`, which
   changes every running session. Doc-3 and doc-4 worked around it with unmanaged
   variant files and per-session `--settings` and `--agents` overrides, which
   cover styles and agents but not skills or `CLAUDE.md`.
4. Three prompts have no non-interactive path: the calibration pause (edit files,
   press Enter, in a loop), the revised-Judge confirmation (type yes), and the
   failure pause (press Enter to restore). Confirmation approval has `--yes`;
   the rest need a TTY. Without a TTY the failure pause degrades to an immediate
   restore, which is right; the calibration pause has no degraded path.
5. No `--help`; an unknown flag reports "Invalid argument sequence". No list or
   show: to replay, a session must read `.benchmark-runs/` and parse timestamp
   names; to read a report it opens JSON under a SHA-named directory.
6. Human text only for the replay attempt comparison. Confirmation and comparison
   already write strict JSON reports, but nothing prints them and nothing gives a
   summary a session can paste onto a card.
7. Three entry points with three flag dialects (`--target` versus `--run --stage`
   versus a positional manifest) and no shared name; the README calls them by
   their `bun run` script names.

## What is already there to build on

Strict zod records for every artifact (run, stage, checkpoint, replay, group, rep,
report, comparison); the confirmation report with success rate, standard error,
pass^k, cost and token distributions; `--confirm --reps --yes` with a deterministic
cost ceiling before any paid work; retention refs that pin result commits; the
corpus-to-stage map and stale marking (ACT-4); a corpus snapshot install into a
worktree (`installStageCorpusSnapshot`); the sealed Judge session; the injected
dependency style that keeps every paid call behind a boundary. The CLI work is
mostly exposure, not new machinery, except for the case model.

## Prior art

- Promptfoo: `eval` with `--repeat`, `-o results.json`, `list`, `view`; a YAML
  case declares prompt, provider, and assertions; a deterministic assertion
  vocabulary beside model-graded rubrics. Closest shape for the case file and the
  assertion list. Single-call only.
- Inspect AI (UK AISI): a task is dataset plus solver plus scorer; `inspect eval`
  writes a log of every sample, transcript, and score; `inspect view` and
  `inspect log` read them. Closest shape for the log-first design: the record is
  the product, the CLI reads it.
- Agent-facing CLI checklists (2026): non-interactive by flag, every command
  offers structured output, stdout carries data and stderr diagnostics, exit codes
  mean what they say, help text is complete because the agent reads it instead of
  the docs, IDs are stable and accepted back as arguments.
- The staged SDLC loop with judged transitions, checkpoints, and replay stays
  custom (research.md, prior art).

## Proposed surface

Names are provisional; Shape settles them. One executable, `rehearsal`, with
subcommands. Every command: `--help`, `--json` (the strict record, or a list of
them), stdout data only, stderr diagnostics, no prompt that lacks a flag, and a
fast failure before paid work when a needed approval is absent and stdin is not
a TTY.

```
rehearsal run       [--case <id>] [--corpus <source>] [--confirm --reps N --yes] ... knobs
rehearsal replay    <run> --stage <stage> [--corpus <source>] [--confirm ...]
rehearsal compare   <manifest>
rehearsal review    <run> --file <review.json>        # or --verdict/--summary/--finding
rehearsal calibrate <run>                              # rejudge frozen evidence, record
rehearsal list      cases|runs|checkpoints|attempts|groups|comparisons
rehearsal show      <id> [--json | --markdown]         # any record by its ID
rehearsal stale     [--corpus <source>]                # what an edit invalidated
rehearsal case      list|show|capture <session> --cut <index>
```

Exit codes: 0 when the command completed and its record was written, whatever
the grade; a failed grade is evidence, not an error. Non-zero for usage errors,
refused preconditions, and execution failures, with the reason on stderr.

## Decisions taken here, with the reason

- Cases live in this repository under `cases/<id>/`, never beside the corpus. The
  dotfiles evals sat beside the agent they graded and were deleted with it at the
  corpus swap. Design decision 5 already says tool material lives here.
- The case at the control root today (audit log against the NestJS template)
  becomes `cases/audit-log` and stays the default when `--case` is absent.
- Two case kinds. `pipeline` is today's stage graph. `session` is one Claude
  session: a working directory or fixture tree, a prompt, an optional transcript
  prefix to resume, tool and settings overlays, and the corpus files it reads.
  Doc-3, doc-4, brief-split, and the known-answer cases are all session cases.
- Judges for a session case: a deterministic check list over the reply and the
  transcript (word band, forbidden characters, sentence subset, agent dispatched
  with named parts, files read, tool calls made), a known-answer key graded by
  the sealed Judge, or a rubric. Deterministic wherever possible, per the vision.
- A `run` without `--pause` ends by writing the preliminary artifact, pinning the
  candidate under a retention ref, restoring the target, and exiting. Calibration
  already rejudges frozen evidence, not the live target, so nothing is lost;
  `show <run> --checkout <dir>` materializes the candidate for inspection.
- Comparison manifests are generated by the CLI from group IDs, so a session never
  hand-writes one.
- The corpus variant comes from a source, not the install: a directory, or a
  chezmoi source at a git ref rendered with `chezmoi apply --destination <dir>`
  (flag verified present on chezmoi v2.72.0; rendering into a scratch destination
  is inferred and must be observed first).

## Decided by João, 2026-09-02

1. A session running against a corpus variant sees a copy of the live config
   with only the files under test replaced, so hooks, memory, and MCP stay as
   the README requires and nothing live is touched. To observe at Shape:
   whether a copied config carries login state.
2. Session-case transcript bytes are git-ignored under `.benchmark-runs/cases/`
   and hashed into lineage, the same way checkpoints are kept; only the case
   declaration is committed.

### The mechanism under decision 1, replaced at ACT-26.6 Shape

Decision 1's intent stands: the session sees the live hooks, memory, and MCP,
only the files under test are replaced, and nothing live is touched. The
mechanism it named — a copy of the config directory — cannot serve it, and the
observation that settles this was taken 2026-09-02: copying `settings.json` and
`.claude.json` into a scratch `CLAUDE_CONFIG_DIR` and running `claude -p` there
returns "Not logged in · Please run /login". Login state lives in the keychain,
outside the config directory, so a copied config needs an interactive login per
copy and is unavailable to an autonomous run.

The mechanism that serves the same intent is an overlay inside the attempt
directory, which the harness already owns and which no live session reads. The
session runs with the live config, so hooks, memory, and MCP are the real ones;
the corpus files under test are placed as project-level files that shadow the
user-level ones. Observed at ACT-26.6 Shape, 2026-09-03, on claude 2.1.258:
project-level output styles and agent definitions shadow same-named user-level
ones, and project-level skills do not (ACT-28). The intent is João's; the
mechanism is not the one he named, and this is why.

## Card map and recommended order

Replace the scripts first, then the terminal touchpoints:

1. ACT-26.4 cases as data, then ACT-26.5 the session case kind (ACT-25 waits on
   it), then ACT-26.6 corpus variants from a source. Together these are what
   doc-4 and brief-split needed.
2. ACT-26.1 one entry point with help, JSON, and exit codes; ACT-26.2 list, show,
   stale; ACT-26.3 review and calibrate without a paused process.

Glossary terms to settle at Shape: case kind, session case, corpus source,
check list.
