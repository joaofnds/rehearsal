---
id: doc-10
title: shape-ACT-66-drop-chezmoi-corpus-source
type: other
created_date: '2026-09-04 18:23'
---


## Goal

`--corpus` takes a directory in corpus layout and nothing else, so the harness
reads a corpus without knowing what produced it.

## What the repository settled

Every question the card raised is answerable from the code and from
`.benchmark-runs`, so none of them went to João. Commands were run
2026-09-04 at e48a660.

**The discriminant does not collapse.** The card asks whether removing the kind
leaves a root plus a provenance label. It does not. `live` carries behavior in
four places that `directory` does not, and each is a real branch rather than a
leftover:

- `snapshotSessionCorpus` returns the live root by naming it instead of copying
  it, because a copy would change the resolved paths every pre-`--corpus`
  record carries.
- `installSessionCorpusSnapshot` overlays nothing for a live corpus, since the
  bytes are already installed.
- `stageCorpusRoots` searches the project-then-user pair for live and only the
  source root otherwise.
- `resolveCorpusSource(undefined)` produces it.

So `ResolvedCorpusSource` becomes a two-member union, `live | directory`. That
satisfies acceptance criterion 2 as written: no kind names a producing tool.
Collapsing further would inline the live/copied distinction into every caller,
which is the coupling the type exists to hold.

**`INSTRUCTIONS_SOURCE_PATH` dies whole.** With chezmoi gone, `live` and
`directory` both map `CLAUDE.md` to `CLAUDE.md`. The per-kind map added by
398ae27 becomes a constant, and `resolveCorpusFile` reads
`CORPUS_INSTRUCTIONS_PATH` directly. `CHEZMOI_LAYOUT` dies and
`INSTALLED_LAYOUT` becomes the only layout table.

**Nothing on disk carries a chezmoi origin.** Verified over every
`.benchmark-runs/sessions/*/*/attempt.json`: two records carry
`corpusOrigin {"kind":"live"}` and the rest carry no `corpusOrigin` field at
all, because they predate it. No record anywhere under `.benchmark-runs`
mentions chezmoi. This is the evidence for the schema decision below.

**The symlink refusal survives, and its comment does not.** `refuseSymlinks`
is written against any source, and the card is right that a render is what
motivated it. It stays because a directory a user renders with their own tools
can hold symlinks just as a render did, and dereferencing one would snapshot
bytes from outside the corpus while the record claims otherwise. Only the
comment naming chezmoi as the reason changes.

**The prohibition behind this card is measured.** ACT-26.6 shipped the chezmoi
source and doc-8 recorded its symlink refusal as correct and worth keeping,
which is the constraint this card overturns. What backs the overturn is not a
cost prediction: it is that no record on disk has ever used the feature, and
that the same corpus is reachable by rendering outside rehearsal and passing
the directory. That is an observation, not an argument, so no experiment is
owed before designing.

## Approach

Revert direction, not refactor direction, as the card says. There is only one
sane way to build it, so no survey: delete the `chezmoi` member and everything
that exists only to serve it, then let the type checker find the callers.

Where it fails: the type checker finds every branch on `source.kind ===
"chezmoi"`, but it does not find a test that asserts a chezmoi string is
*accepted*. Those tests are deleted rather than repointed, and criterion 1's
rejection test is what replaces them. It also does not find the README and
GLOSSARY prose, which is why criterion 5 exists.

What it assumes: that `--corpus chezmoi:<ref>` failing is acceptable rather
than needing a deprecation path. Nothing on disk used it and the CLI is not
published, so a plain rejection is honest.

Cost to reverse: the deleted code is one revert away in git history at
e48a660. That is the reason to delete rather than to keep a seam for it.

## The schema decision

Criterion 4 offers two answers. The honest one is to drop the chezmoi member
from `corpusSnapshotOriginSchema` and say why: no record on disk carries it,
verified above, so preserving a parse path for a record that has never existed
would be carrying a fiction. `corpusOrigin` is already `.optional()`, so the
records that predate the field keep loading, which is the only backward
compatibility the disk actually asks for.

`CorpusSnapshotOrigin` becomes `{kind:"live"} | {kind:"directory", source}`.
The build should record this reasoning in the card's notes, since criterion 4
asks for the record to say why.

## Sequencing against ACT-65

Do ACT-66 first, as the card says. ACT-65 turns on where a stage session reads
project instructions from, and `INSTRUCTIONS_SOURCE_PATH` is exactly the map
that answers "where does this source keep CLAUDE.md". Collapsing that map to a
constant removes one variable from ACT-65's investigation. ACT-66 does not fix
ACT-65 and does not depend on it.

## Test list

Written first, each failing before the change:

1. `resolveCorpusSource("chezmoi:HEAD")` rejects with a `CorpusSourceError`
   naming the source and saying a corpus source is a directory. Fails today
   because it resolves.
2. `resolveCorpusSource` over a directory holding `.claude/CLAUDE.md` but no
   root `CLAUDE.md` enumerates no instructions entry. Pins that the per-kind
   instructions map is gone.
3. `corpusLayoutEntries` over a fixture holding both `.agents/skills/x` and
   `skills/x` enumerates only `skills/x`. Pins that `CHEZMOI_LAYOUT` is gone.
4. A `corpusSnapshotOriginSchema` parse of `{kind:"chezmoi",ref,commit}` is
   refused, and a record with no `corpusOrigin` still parses.
5. `refuseSymlinks` still refuses a symlinked entry under a directory source.
   Should pass before and after; it guards the survivor.

The chezmoi tests in `corpus-source.test.ts`, `session-corpus.test.ts`,
`stale-command.test.ts`, `session-record.test.ts`, `config.test.ts`,
`corpus-file.test.ts`, `checkpoint.test.ts`, `commands.test.ts`, and
`session-run-command.test.ts` are deleted, not repointed. Deleting a test that
pins deleted behavior is correct; the ones above replace their guarantees.

## Scale

`grep -rio chezmoi --include='*.ts' src/ | wc -l` gives 104 across 15 files,
run 2026-09-04 at e48a660. `src/benchmark/corpus-source.ts` is
328 lines and loses roughly 120, including `renderChezmoi`, `discardRender`,
`shellQuoted`, `optionRefRefusal`, `resolvedCommit`, `scratchDirectory`,
`COMMIT_SHA`, `CHEZMOI_SCHEME`, `CHEZMOI_LAYOUT`, and
`CorpusSourceDependencies` with its `runCommand` and `dotfilesDirectory`, which
no other source kind needs.

`CorpusSourceDependencies` disappearing changes `resolveCorpusSource`'s
signature and the `stale` command's `corpusSource` dependency slot. That is the
largest ripple and it is mechanical.

## Glossary

Three entries name chezmoi and all three are edited rather than deleted, since
the concepts survive without it: **Corpus snapshot origin** drops the chezmoi
ref and the commit sentence, **Corpus source** becomes a directory in corpus
layout or the live install, and **Corpus variant** loses its chezmoi example.
No new term is introduced: this card removes a concept rather than adding one.
