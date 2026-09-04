---
id: doc-9
title: context-manifest-design
type: other
created_date: '2026-09-04 14:55'
---

# The context manifest — knowing everything an agent loaded

## The idea

When an attempt runs, the harness should identify every instruction file,
document, and config the agent actually loaded, record them as one manifest, and
let an operator vary any of them to shape the output. Today the harness knows a
fraction of that, and the fraction it knows is declared by hand rather than
observed.

## What exists today

Three pieces are already built, and they are the right three:

- **A declared corpus.** A session case names the corpus files it reads
  (`corpusFiles`), those files are hashed before any provider call, and the
  digests land in the attempt record. `resolveCorpusFile` maps a corpus layout
  path onto whichever source the run selected.
- **Variation of that corpus.** `--corpus <dir>` or `--corpus chezmoi:<ref>`
  swaps the whole instruction set, `compare` reports paired results across
  arms, and every arm carries a mandatory minimal-corpus control.
- **Staleness over it.** `captureStageCorpus` hashes the corpus that produced a
  checkpoint, so an edit to any hashed file invalidates the checkpoints
  downstream of it.

So "fine-tune what the agent loads and iterate" already works, for the files a
case declares.

## The three real gaps

### 1. The declared set is a guess, never checked against what loaded

`corpusFiles` is written by hand. Nothing compares it to what the session
actually read. A case that forgets to declare a skill still runs, and its
attempt record then claims a corpus that is not the one the session had. This is
the same class of defect as ACT-41: a recorded measurement of a corpus the
session never read.

The provider does record this. Verified 2026-09-04 against
`.benchmark-runs/cases/brief-reply-02f0f204/02f0f204-...-cut-1270.jsonl`
(1270 lines):

    $ jq -r 'select(.type=="attachment") | .attachment.type' <file> | sort | uniq -c
        219 output_style
        217 total_tokens_reminder
          3 queued_command
          3 edited_text_file
          2 command_permissions
          1 skill_listing
          1 mcp_instructions_delta
          1 deferred_tools_delta
          1 auto_mode
          1 agent_listing_delta

An `output_style` attachment carries `{type, style}`, where `style` is the name
(`"brief"`). A `skill_listing` attachment carries the full listing text. A
`Skill` tool call records which skill was invoked and with what args:

    $ jq -c 'select(.type=="assistant") | .message.content[]?
             | select(.type=="tool_use" and .name=="Skill") | .input' <file>
    {"skill":"doctrine","args":"quality at source, defect prevention, ..."}

So the transcript names the output style in force, the skills offered, the
skills invoked, the agents offered, and the MCP instructions, plus every file
read through the `Read` tool.

### 2. The transcript names loads but does not carry their content

This is the boundary the design has to respect. The provider records *that* the
`brief` style was in force and *that* `doctrine` was invoked. It does not record
their bytes. Verified: the live corpus `CLAUDE.md` content
("Working with João") appears zero times in that transcript.

The consequence: an observed manifest can name what loaded, but only the corpus
resolver can supply the bytes for it. Reconciliation is therefore
name-against-name, and the hash comes from the resolver, not the transcript.
This is fine, and it is what makes the manifest cheap: no transcript parsing has
to understand instruction content.

### 3. The corpus layout covers less than a real session loads

`CORPUS_LAYOUT_PREFIXES` is `output-styles/`, `agents/`, `skills/`, plus
`CLAUDE.md`. A real session on this machine also loads, from `~/.agents/`:
`rules/` and `AGENTS.md`, and from a target repository: its own `CLAUDE.md` or
`AGENTS.md`, its `GLOSSARY.md`, and whatever documents a card attaches.

Two distinct kinds are missing, and they should not be conflated:

- **Corpus kinds not yet in the layout** (`rules/`). These are the engineer's
  global instruction set, they vary with `--corpus` like everything else, and
  adding them is a layout change.
- **Project context** (the target's own instructions, glossary, and the
  documents a stage reads). These are a property of the target repository, not
  of the corpus. ACT-41 establishes exactly this separation for `CLAUDE.md`.
  They vary per case, not per corpus arm, and pretending otherwise would let a
  corpus A/B silently change the target's documents too.

## The concept

**Context manifest** — the complete set of instruction and context inputs one
attempt actually loaded, each named, classified by tier, and hashed where the
harness can resolve its bytes. It has two halves: the **corpus half** (the
engineer's global instruction set, varied by `--corpus`) and the **project
half** (the target repository's own instructions and documents, a property of
the target). It is *observed* from the transcript and *reconciled* against what
the case declared, so a divergence is reported rather than silently recorded.

This is the concept the vision's attribution claim already assumes. "When a
stage is re-run with frozen inputs and one skill changed, the delta belongs to
that edit" is true only if the frozen inputs are known to be the whole input
set. Today that is asserted, not observed.

## Why this order

The reconciliation gap (1) is worth closing before the coverage gaps (3),
because it is what tells you the coverage is wrong. A manifest that reports
"the session loaded the `refactor` skill, which this case never declared" is
the thing that finds the missing kinds, rather than someone remembering them.
And it is the cheapest of the three: it reads records already on disk and needs
no provider call.

The corpus-layout extension (`rules/`) is small and mechanical once the
manifest reports what is missing.

The project half is the largest, is entangled with ACT-41, and should not start
until ACT-41 has landed the corpus/project separation for `CLAUDE.md`. Building
project-context tracking on top of the current conflation would bake it in.

## What this is not

Not a change to how the corpus is varied. `--corpus` and `compare` already do
that, and nothing here proposes replacing them. The manifest tells you what you
varied and what you missed; it does not become a second way to vary it.

## Cards

- **ACT-59** — observe the context manifest from the transcript and reconcile it
  against the declaration. Closes gap 1.
- **ACT-60** — carry `rules/` in the corpus layout. Closes the corpus half of
  gap 3, once ACT-59 reports what is missing.
- **ACT-61** — record the project half of the manifest. Depends on ACT-41.
