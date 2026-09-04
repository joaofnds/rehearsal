# ACT-41 — separate the corpus instructions from the target's project instructions

## Goal

A pipeline stage session reads the corpus's global instructions and the target
repository's own project instructions, and the harness never writes the control
repository's project file into a target that is not the control repository.

## The premise the card assumes, and where it is wrong

The card frames this as "the harness installs the wrong file into the target",
and asks in criterion #3 how to preserve the corpus-under-evaluation meaning of
the control `CLAUDE.md`. That framing accepts a premise that does not hold: that
`rehearsal/CLAUDE.md` is the corpus file under evaluation.

It is not, and nothing in the design ever said it was. Evidence:

- The corpus is defined as the *global* instruction corpus. `GLOSSARY.md:81`
  calls it "the installed `CLAUDE.md`, the stage skills, the output styles, and
  the agent definitions". `docs/vision.md:36` classes `CLAUDE.md` with doctrine
  as the global tier that "touch[es] every stage".
- Every other corpus kind is already resolved from the live install.
  `stageCorpusRoots` (`src/benchmark/checkpoint.ts:120`) resolves skills, agents,
  and output styles through `corpusLayoutRoots`, which searches
  `<target>/.claude` then `~/.claude`. Only `CLAUDE.md` is special-cased to the
  control root, in `PROJECT_INSTRUCTIONS_PATH` (`src/benchmark/config.ts:18`).
- The corpus `CLAUDE.md` already exists at that live root, and is the global
  file. Observed 2026-09-04:

      $ ls -la ~/.claude/CLAUDE.md
      ~/.claude/CLAUDE.md -> /Users/joaofnds/.agents/AGENTS.md

  It is 10498 bytes and opens "# Working with João". The control repository's
  own `CLAUDE.md` is 2917 bytes and opens "# Project Core Guidelines".

- The constant was never a decision. `git log -S` shows it introduced by
  116f8f7, "refactor(corpus): give the project instructions one named home",
  whose body says it only collapsed four sites that each built
  `join(CONTROL_DIR, "CLAUDE.md")` for themselves. The refactor preserved a
  choice that predates it and that no commit argues for.

So there is nothing to preserve. Criterion #3 dissolves: the corpus meaning
attaches to `~/.claude/CLAUDE.md`, which the corpus resolver already reaches,
and the control repository's project file returns to being what it is, this
project's own instructions, read by sessions working *on* rehearsal and by
nothing else.

The real defect is that one string, `instructions`, carries two unrelated
meanings through the whole harness: the corpus file whose quality is being
graded, and the project instructions installed into the target's tree. Splitting
them is the work.

## Where the conflation reaches

One value flows from `readProjectInstructions()` into three different jobs:

1. **Installed into the target.** `run.ts:866` reads it and hands it to
   `createTaskCommit`, which calls `installInstructions`
   (`src/benchmark/backlog.ts:124`) to write and commit `CLAUDE.md` into the
   target repository. Same path in `replay-command.ts:216`.
2. **Hashed into stage-corpus lineage.** `captureStageCorpus`
   (`checkpoint.ts:187`) records `{ path: "CLAUDE.md", sha256: sha256(instructions) }`
   as the corpus's first file, so an edit to it makes checkpoints stale.
   `snapshotStageCorpus` writes the same bytes into the frozen corpus directory.
3. **Offered as an edit target by calibrate.** `calibration.ts:456` names the
   path in the "update these files" prompt, and `readCurrentSources` re-reads it
   to detect the human's edit.

Jobs 2 and 3 are corpus jobs and are correct in intent, wrong only in which file
they read. Job 1 is not a corpus job at all and should not exist for a target
that carries its own instructions.

`resolveCorpusFile` (`corpus-file.ts:53`) already special-cases layout path
`CLAUDE.md` to `PROJECT_INSTRUCTIONS_PATH` when the source is live, and
`session-corpus.ts:174` does the same for a chezmoi render. Both are the same
bug in the session half, and both stop needing the special case once the live
root supplies the file like every other corpus kind.

## Options

**A. Point the corpus at the live root; install nothing into the target.**
`PROJECT_INSTRUCTIONS_PATH` becomes `~/.claude/CLAUDE.md`, resolved through the
corpus source like every other kind. The target keeps whatever instructions it
has in its own tree, and the harness writes none. `installInstructions` is
deleted from the run and replay paths.

Buys: the corpus definition and the code finally agree; the special cases in
`corpus-file.ts` and `session-corpus.ts` go away; a target's real instructions
are what the agent reads, which is what the benchmark is meant to simulate.

Costs: the corpus `CLAUDE.md` is no longer inside a git-committed tree the
harness controls, so `installInstructions`'s commit no longer pins it. Lineage
still pins it by hash, which is what staleness actually reads, so this costs
nothing real.

**B. Install the target's own instructions, read from the target.**
Keep `installInstructions`, but source its bytes from the target's existing
`CLAUDE.md`/`AGENTS.md` instead of the control root.

Rejected. It is a no-op that rewrites a file with its own contents, and for a
target with no instruction file it has nothing to write. The audit-log target
has neither file (verified 2026-09-04: `ls ../nest/template/CLAUDE.md
../nest/template/AGENTS.md` returns two ENOENTs).

**C. Let a case declare its target's project instructions.**
Add an optional field to the pipeline case's `target` object naming a file to
install.

Rejected for now. It buys the ability to benchmark a target under instructions
it does not have, which no case wants today, and it adds a case-declaration
field that would have to be designed, validated, confined, and recorded. If a
case ever needs it, it is additive on top of A.

**A wins**, and it is the only one the evidence leaves standing: the corpus file
already exists at the live root, and the target's instructions are a property of
the target.

## Where A could fail

- **`~/.claude/CLAUDE.md` may not exist on another machine.** `stale` already
  handles this: `projectInstructions` (`staleness-report.ts:128`) resolves the
  corpus file and raises `CorpusFileError` naming the path when it is absent.
  The run path needs the same refusal rather than an ENOENT. This is what
  criterion #2 asks about, and the answer below records it.
- **It is a symlink here.** `session-corpus.ts` refuses symlinks when copying a
  corpus, because a symlink would snapshot bytes from outside the source. The
  live path does not copy, it reads, so the refusal does not fire for `run`. A
  session case declaring `CLAUDE.md` against a *directory* or *chezmoi* source
  is the case to check, and the chezmoi special case at line 174 is being
  removed, so the render must supply the file itself. A chezmoi render of
  `dot_claude/symlink_CLAUDE.md.tmpl` produces a symlink to
  `~/.agents/AGENTS.md`, outside the render, which the existing refusal will
  catch. That refusal is correct and should stay: it is honest to say a chezmoi
  corpus cannot deliver this file rather than silently reading the live one, as
  line 174 does today.
- **Reversal cost is one commit.** No recorded artifact's schema changes. Old
  records keep whatever hash they recorded; they are stale against the new
  corpus, which is true and is what staleness is for.

## The decision criterion #2 asks for

*A run against a target that declares no project instructions proceeds without
installing any.* The harness installs nothing into any target, whether or not
the target has instructions of its own. The reason: the target's project
instructions are a property of the target, and a benchmark that rewrites them is
measuring a repository that does not exist. A target with no instruction file is
a valid target, and the agent working in it reads the corpus's global
instructions and the code, which is exactly what an engineer's agent does in an
uninstrumented repository.

What is refused instead is a missing *corpus* `CLAUDE.md`. A corpus source that
holds no `CLAUDE.md` cannot supply the global tier a stage is graded against, so
`run` and `replay` refuse before any provider call, with the resolved path in
the message, the way `stale` already does.

## Acceptance observations

1. A `run` against the audit-log case leaves the target's tree with no
   `CLAUDE.md` added and no "chore: configure project instructions" commit. The
   observation is `git log --oneline` in the target worktree after the initial
   checkpoint, showing the task commit and nothing else.
2. A stage's recorded corpus hashes the bytes of `~/.claude/CLAUDE.md`. The
   observation is a test asserting the checkpoint record's `CLAUDE.md` sha256
   equals the sha256 of the live corpus root's file, and not that of the control
   repository's.
3. `run` and `replay` against a corpus source holding no `CLAUDE.md` fail before
   any provider call with a message naming the resolved path. The observation is
   a test that resolves a corpus directory holding only `output-styles/` and
   asserts the refusal.
4. `resolveCorpusFile` returns a path under the source root for layout path
   `CLAUDE.md` for every source kind, with no live special case. The observation
   is the existing `corpus-file.test.ts` assertions updated to the live root and
   passing.
5. A session case declaring `CLAUDE.md` against a chezmoi source is refused as a
   symlink rather than silently reading the live install. The observation is a
   test over `copyDeclared` with a rendered source whose `CLAUDE.md` is a
   symlink.
6. The audit-log case re-run's shape agent reports no contradiction between its
   instructions and the codebase, and asks no question at completion about the
   instruction file. The observation is the stage's completion message in the
   run record.

## First test to write

`corpus-file.test.ts`: `resolveCorpusFile` with a live source and layout path
`CLAUDE.md` returns `join(liveCorpusRoot(), "CLAUDE.md")`. It fails today,
returning the control repository's path.

## Glossary terms to add

- **Project instructions** — the instruction file a repository carries in its own
  tree for agents working in it (`CLAUDE.md` or `AGENTS.md`). A property of the
  repository, never installed by the harness. Distinct from the corpus's global
  `CLAUDE.md`, which is the file under evaluation.

The existing **Corpus (instruction corpus)** entry stays as written; it already
says "the installed `CLAUDE.md`", meaning the live install, which is the reading
this card restores.
