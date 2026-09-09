---
id: doc-58
title: Shaping ACT-137 live corpus containment
type: other
created_date: '2026-09-09 17:30'
updated_date: '2026-09-09 19:05'
---

## Goal

`GET /api/corpus` never serves a digest over bytes the corpus does not hold, and
never fails with a 500 when the corpus root holds a file it cannot honestly hash.

## Status of this shaping

**The build is blocked on one operator decision.** The extent a live corpus
install may resolve into cannot be derived from anything the harness can read, so
the containment half of this card cannot be designed until it is declared. The
decision, the recommendation, and the work that is unblocked regardless are all
below.

## The one route that exists

`corpusReport` has exactly one non-test caller, `src/server/api.ts:77`. Its
`corpusSource` comes from `ApiDependencies`, set in one place for the server,
`src/server/serve.ts:53`, as `liveCorpusSource()`. `--corpus` is a flag on `run`,
`replay` and `stale` only, and none of those calls `corpusReport`.

Verified 2026-09-09:

    grep -rn "corpusReport" src client --include="*.ts" --include="*.tsx" | grep -v "\.test\."
    grep -rn "corpusSource" src --include="*.ts" | grep -v "\.test\."

(A live source is also constructed at `src/benchmark/corpus-source.ts:127` by
`resolveCorpusSource(undefined)`, which the CLI paths use. The claim above is
about the server's dependency specifically.)

So the corpus screen is served by a live source and nothing else. A fix that
works only for a directory source fixes nothing a user can see.

## The defect, reproduced on the served route

Both halves reproduce on a live source. probe B2 (script deleted; output quoted here), run 2026-09-09,
on a root whose `agents/` is a symlink to an outside directory:

    directory RESOLVED files: [CLAUDE.md] digest: undefined refusals: 1
    live      RESOLVED files: [CLAUDE.md, agents/stolen.md] digest: 693a5e refusals: 0

The live source serves a file from entirely outside the root as ordinary corpus
data under a confident digest with no refusal.

And on the operator's genuine install, the instruction file already resolves out
of the root (probe 1 (script deleted; output quoted here), 2026-09-09):

    CLAUDE.md -> /Users/joaofnds/.agents/AGENTS.md
    files 122 digest c7000b refusals 0

Digest `c7000b` covers bytes `~/.claude` does not hold. Whether that is a defect
or the design is precisely the operator question below.

## What the probes established

### Every predicate derived from the root's own contents can be laundered

This is the load-bearing finding, and it rules out every predicate the harness
could compute for itself.

An anchor at the layout entry is vacuous at the top level: a top-level entry is
its own anchor (probe 2 (script deleted; output quoted here), 2026-09-09: `hostile CLAUDE.md contained?
true`).

Capturing trusted trees at construction, by resolving the install's own top-level
entries, fails the same way, because the capture step resolves *through* the
hostile link and admits the attacker's target into the trusted set
(probe 7 (script deleted; output quoted here), 2026-09-09):

    agents contained? true
    agents/stolen.md contained? true

Convergence on a common parent is not a discriminator either: on a root whose
only link is the hostile one, that link's target becomes the trusted tree.

Nothing intrinsic separates a benign top-level link from a hostile one
(probe 6 (script deleted; output quoted here)): `CLAUDE.md`, `skills`, `agents` and `rulebook` are
ordinary symlinks into a sibling tree, identical in kind to a planted link.

**The rule this yields:** trust must come from outside the corpus root, because
anything inside it is what the attacker or the drift controls. A declared extent
is the only form that survives (probe 8 (script deleted; output quoted here), 2026-09-09, with the
extent declared as `[~/.claude, ~/.agents]`): every live entry contained, the
hostile `agents/` refused.

### The layout path does not go through `refuseUncontained`

`refuseUncontained` is called only from `corpus-file.ts:156` and `:198`. The
corpus screen's layout loop calls `walkDirectory(absolute, directory, {
rootMayBeALink: source.kind === "live" })` at `corpus-report.ts:94-96` and
nothing else. Verified 2026-09-09 by `grep -rn "refuseUncontained" src` and by
reading the loop.

So a fix aimed only at `refuseUncontained` cannot change the symlinked-`agents/`
behavior. The two halves of this card sit on two call paths and a complete fix
touches both. This also matches ACT-137's own triage note, which used exactly
this probe to keep ACT-137 and ACT-134 separate.

## The operator decision this is blocked on

**May the live install's wiring resolve anywhere, or must it stay inside a
declared extent, and what is that extent?**

Decision-4 says a live corpus is "the install on the running machine, enumerated
and hashed as it is today" and names no extent. That reads as "anywhere", and on
that reading the digest over `~/.agents/AGENTS.md` is correct and ACT-137 is
invalid as filed. ACT-137, ACT-134 and ACT-135 all assert the opposite, that a
digest must not cover bytes the root does not hold, and ACT-135 already shipped
that rule for directory sources.

This session cannot settle it, because:

- No source names an extent. Checked: `GLOSSARY.md`, `docs/vision.md`,
  `docs/design.md`, decision-4, and `grep -rn "homedir()" src`.
- No probe can settle it, because it is a statement about where the operator's
  install is *permitted* to point, not about where it does point.
- Every derivable answer is laundered, per the finding above.
- The card's criteria asserting the extent were authored by prior agent sessions,
  not typed by the operator, so they are this board's claim rather than a
  direction, and a claim is tested rather than inherited.

**Recommendation:** the extent is the live install root plus the real path of the
tree its own layout entries point into, declared as configuration read from
outside the corpus root, defaulting to `[liveCorpusRoot(), <that tree>]`. On this
machine that is `[~/.claude, ~/.agents]`, which passes the live install unchanged
and refuses the hostile root (probe 8 (script deleted; output quoted here)). Declared, not discovered,
is the whole point: a value the root cannot rewrite.

**If the operator answers "anywhere":** ACT-137 and ACT-134 both close as
working-as-designed, and the only work left is Change B below, which is worth
doing either way.

## What is unblocked regardless: Change B

Independent of the extent question, one real defect is ready to build.

`hashCorpusLayout` (`src/server/corpus-report.ts:81-86`) calls `hashCorpusFiles`
for `CORPUS_INSTRUCTIONS_PATH` outside any try, while the layout loop below it
wraps every directory in a try/catch that turns `SymlinkedEntryError` into a
refusal string. So a `SymlinkedEntryError` on the instruction file reaches
`app.onError` and becomes a 500, since `src/server/api.ts:76-83` wraps the route
in no try/catch.

Verified 2026-09-09, probe 5 (script deleted; output quoted here), directory source on a root whose
`CLAUDE.md` is a symlink outside it:

    THREW SymlinkedEntryError Corpus file CLAUDE.md resolves outside the corpus source

Fix: wrap that call in the same try/catch the directory loop uses, rethrowing
anything that is not a `SymlinkedEntryError`. `corpusReport` already suppresses
the digest whenever `refusals` is non-empty.

This is worth doing now because it is a prerequisite for *any* answer to the
extent question: the moment live containment refuses anything, without this the
operator's own corpus screen becomes an error page.

Two things the builder must handle, both from review:

- The refusal from `refuseUncontained` (`corpus-file.ts:133`) names only the
  layout path, never an absolute path, so `redactAbsolutePaths` is a no-op on it.
  Copying the directory loop verbatim is still correct.
- The client's refusal block (`client/src/corpus/corpus-page.tsx:54-66`) prints
  fixed prose reading "These entries could not be hashed, so their layout
  directory is missing from the table whole". A `CLAUDE.md` refusal is not a
  layout directory, so that prose becomes false. The copy needs to cover the
  instruction file, or the two cases need distinct wording.

### Acceptance for Change B

1. `corpusReport` on a directory source whose `CLAUDE.md` is a symlink to a file
   outside the root returns a report whose `refusals` contains a string naming
   `CLAUDE.md` and whose `digest` is `undefined`, rather than throwing.
   (Reproduced 2026-09-09, probe 5 (script deleted; output quoted here): it throws.)
2. `GET /api/corpus` with that source injected through `ApiDependencies` returns
   200 and a body whose `refusals` names `CLAUDE.md`. (`src/server/api.ts:49`
   takes `corpusSource` as a dependency, so a test injects it; ACT-135 AC#7 is
   the reason 500 is unacceptable.)
3. The corpus screen given that report renders text naming `CLAUDE.md` and does
   not render "Could not load the corpus."
   (`client/src/corpus/corpus-page.tsx:40` pins that text to `query.isError`.)
4. The live corpus report is unchanged: 122 files, digest `c7000b`, zero
   refusals. (Measured 2026-09-09, probe 1 (script deleted; output quoted here). This is a
   regression guard, not a new behavior.)
5. `bun run test`, `bun run lint`, `bun run typecheck`, `bun run fmt:check` all
   pass. (The project's own check, `CLAUDE.md`.)

### First test to write

In `src/server/corpus-report.test.ts`, against `directorySource(root)` where
`root/CLAUDE.md` is a symlink to a file outside `root`: assert
`report.refusals` contains a string matching `CLAUDE.md` and `report.digest` is
`undefined`. It fails today by throwing `SymlinkedEntryError` before the
assertion runs, which is the red.

## What the extent-dependent build will touch, when it is unblocked

Counted 2026-09-09. Any change to the `CorpusRoot` shape or to live containment reaches:

- `src/server/corpus-report.ts:125`, `:135`
- `src/benchmark/staleness-report.ts:112`, `:286`, `:306`
- `src/benchmark/corpus-source.ts:103`, `:107`, `:127`
- `src/benchmark/session-corpus.ts:70`, `:87`, `:164`, reaching
  `src/cli/session-run-command.ts:90`, which passes a `SessionCorpusSnapshot`
  where a `CorpusRoot` is expected
- `src/benchmark/calibration.ts:459`, which calls `resolveCorpusFile(
  liveCorpusSource(), ...)` synchronously, so making `liveCorpusSource()` async
  breaks it
- `src/benchmark/checkpoint.ts:262` `stageCorpusRoots`, which gives a live source
  the *pair* `[<target>/.claude, ~/.claude]`, so the extent must say which root
  it is captured against when there are two
- `readCorpusInstructions` via `liveCorpusInstructions()`, reached from `run`,
  `replay` and `calibrate`, all of which gain a new refusal path

Recorded checkpoint hashes come from `captureStageCorpus`
(`checkpoint.ts:333-375`) over `LAYOUT_DIRECTORY_KINDS`, which is a different set
from the screen's `CORPUS_LAYOUT_DIRECTORIES`. The screen digest holding at
`c7000b` is evidence about the screen only and says nothing about checkpoint
lineage.

## Housekeeping this session created

The shaping session wrote its probe scripts to an untracked `tmp-probe/`
directory, which made `lint`, `typecheck` and `fmt:check` red while it existed
(15 typecheck errors, 4 lint files, 7 format files, all under `tmp-probe/`, zero
under `src/` or `client/`). The directory was deleted before the session ended.
Every probe's command and output is quoted in this document, which is where they
needed to survive. Re-run of the checks after deletion is recorded in the
session's final summary.

## What ACT-134 inherits

Not a predicate, because there is not one yet. It inherits the finding that no
derived predicate works, the requirement that trust come from outside the root,
and the same operator question. ACT-134 keeps its dependency on ACT-137. Both
cards are blocked on one decision, which is an argument for answering it once
rather than per card.
