---
id: ACT-132
title: >-
  A symlinked CLAUDE.md at the corpus root is followed, bypassing the
  directory-walk refusal
status: Build
assignee:
  - '@claude'
created_date: '2026-09-08 22:44'
updated_date: '2026-09-08 23:33'
labels: []
dependencies: []
priority: high
ordinal: 128008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a corpus root whose CLAUDE.md is a symlink pointing outside the root keeps the target path and bytes out of the corpus report files and digest, refused or omitted (reproduced 2026-09-09: corpusReport on a directory corpus whose CLAUDE.md linked to an outside file returned that file hashed under path CLAUDE.md)
- [ ] #2 a corpus source whose instruction file is a real file still reports it exactly as it does today
- [ ] #3 bun run test, bun run lint, bun run typecheck all pass (the project own check, CLAUDE.md)
- [ ] #4 a directory corpus source whose CLAUDE.md is a symlink to a file outside the root is refused by corpusReport: the outside file's sha256 and bytes appear in neither report.files nor report.digest (reproduced 2026-09-09: corpusReport on such a root returned path CLAUDE.md with sha256 23185939fe8f74ed893c5b8d7d23975d5147105dd17b891df4bc57c66abf3785, equal to shasum -a 256 of the outside file)
- [ ] #5 a directory corpus source whose CLAUDE.md is a symlink outside the root is refused by readCorpusInstructions and by hashCorpusFiles, so stale --corpus and replay --corpus surface a refusal rather than the outside bytes (reproduced 2026-09-09: readCorpusInstructions returned the outside file's text and hashCorpusFiles returned its sha256)
- [ ] #6 a directory corpus source whose declared corpus file inside a layout directory is a symlink outside the root is refused by hashCorpusFiles (reproduced 2026-09-09: hashCorpusFiles on skills/build/LINKED.md -> an outside file returned that file's sha256)
- [ ] #7 the live corpus source keeps reporting through its symlinked CLAUDE.md: corpusReport against ~/.claude returns 123 files with a CLAUDE.md entry (measured 2026-09-09 by corpusReport(liveCorpusSource(), tmpdir) at 2191223; ~/.claude/CLAUDE.md is a symlink to ~/.agents/AGENTS.md, and checkpoint.ts:115-121 with commit 47ed48b state the live install is the trusted root that may be a link)
- [ ] #8 a directory corpus source whose instruction file and declared files are real files reports and hashes exactly as it does at 2191223
- [ ] #9 the refusal names the corpus layout path of the offending file, and its message carries neither the link target's absolute path nor its bytes
- [ ] #10 bun run test, bun run lint, bun run typecheck all pass (the project's own check, CLAUDE.md)
- [ ] #11 a directory corpus source whose CLAUDE.md is a symlink resolving outside the root is refused by corpusReport, readCorpusInstructions and hashCorpusFiles, and the outside file's sha256 and bytes appear in no report, digest or return value (reproduced 2026-09-09 at 2191223: all three returned the outside file's bytes or its sha256 23185939fe8f74ed893c5b8d7d23975d5147105dd17b891df4bc57c66abf3785, equal to shasum -a 256 of the target)
- [ ] #12 a directory corpus source whose declared corpus file inside a layout directory is a symlink resolving outside the root is refused by hashCorpusFiles (reproduced 2026-09-09: hashCorpusFiles on skills/build/LINKED.md -> an outside file returned that file's sha256)
- [ ] #13 a directory corpus source whose layout directory is itself a symlink to a directory outside the root is refused by hashCorpusFiles for a real file inside it, not only by corpusReport (reproduced 2026-09-09: skills/build -> /tmp/act132f/outside/build with a real SKILL.md inside; hashCorpusFiles returned sha256 243fdb41799f5a01066f9dccca1f0809c52858bed6bf92f3ab9d606f90625922, equal to shasum -a 256 of the outside file, while lstat of the resolved path reported isSymbolicLink false and corpusReport refused the same root)
- [ ] #14 a relative symlink out of the root is refused the same way an absolute one is (reproduced 2026-09-09 by the reviewer: ../outside/s.md leaks identically today)
- [ ] #15 corpusReport, readCorpusInstructions and hashCorpusFiles all refuse with SymlinkedEntryError, the type the directory walk already throws, so one planted link produces one error type across every surface (doc-49 section 4: 'refused by the same named error the walk gives')
- [ ] #16 stale --corpus and replay --corpus against such a source exit as a refused precondition rather than an uncaught error, with the refusal text on stderr (stale-command.ts refusingCorpusFailures and staleness-report.ts catch only CorpusSourceError and CorpusFileError today, so SymlinkedEntryError would escape them)
- [ ] #17 the refusal names the offending file by its corpus layout path, and its message carries neither the link target's path nor its bytes
- [ ] #18 a directory corpus source whose root is reached through a symlinked parent directory is reported and hashed, not refused (measured 2026-09-09: realpath of /tmp/act132d/corpus is /private/tmp/act132d/corpus on this machine, so a containment check comparing a realpath against a raw root rejects every fixture under /tmp)
- [ ] #19 the live corpus source keeps reporting through its symlinked CLAUDE.md: corpusReport against ~/.claude returns a CLAUDE.md entry and a file list of the same length it returns at 2191223 (measured 2026-09-09 by corpusReport(liveCorpusSource(), tmpdir()) at 2191223, which returned 123 files; the number tracks this machine's ~/.agents tree and is a baseline to re-measure, not a constant)
- [ ] #20 a directory corpus source holding only real files reports the same paths, sha256 values and digest it reports at 2191223 for the same fixture
- [ ] #21 bun run test, bun run lint, bun run typecheck all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the security reviewer on ACT-113 and reproduced directly in that session.

src/server/corpus-report.ts:69-75 hashes the instruction file through hashFile, never
through hashDirectory, so the symlink refusal ACT-113 added does not see it. hashFile
opens the path, which follows a link.

Reproduction: a corpus root holding only CLAUDE.md -> /tmp/cm/secret.md. corpusReport
returned files ['CLAUDE.md'] with the outside file's bytes hashed under that path.

Pre-existing and in a different code path from the one ACT-113 changed. Its acceptance
criteria all name the directory walk, so this sits outside them; filed rather than folded
in, so each change stays reviewable alone.

Same shape as the root-position leak ACT-113 did close (commit 47ed48b): a link one level
above where the guard looks. Worth settling with ACT-129, which covers the three separate
symlink refusals, since a fourth site here would be a fourth encoding of one rule.

Premise verified 2026-09-09 by the iterating session, before the fix ran: a corpus root holding only CLAUDE.md -> /tmp/act132/outside/secret.md. corpusReport returned one file at path CLAUDE.md whose sha256 equals shasum of the outside file, so the outside bytes are hashed and reported under the in-root path. corpus-report.ts hashCorpusLayout hashes the instruction file via hashFile while the layout directories go via hashDirectory with its rootMayBeALink guard, so the two paths differ as the card records.

## Shaped 2026-09-09

Goal: a corpus source that is declared data cannot hand the harness bytes from
outside its own root through a symlinked single file, the way the directory walk
already prevents for a linked entry.

### What the shaping found that the card did not record

The leak is three sites, not one. corpus-report.ts hashCorpusLayout was the only
one the card named. Verified this session against 2191223, directory source at
/tmp/act132/corpus with CLAUDE.md -> /tmp/act132/outside/secret.md:

- corpusReport returned files[0] = { path: 'CLAUDE.md', sha256:
  23185939fe8f74ed893c5b8d7d23975d5147105dd17b891df4bc57c66abf3785 }, equal to
  shasum -a 256 of the outside file.
- readCorpusInstructions(source) returned "SECRET BYTES\n", the outside file's text.
- hashCorpusFiles(source, ['CLAUDE.md']) returned the same outside sha256.
- hashCorpusFiles(source, ['skills/build/LINKED.md']) on a link inside a layout
  directory returned the outside sha256 too, so the leak is not specific to the
  root position: any single declared file that is a link is followed.

The user-facing surfaces a directory source reaches are stale --corpus
(staleness-report.ts:155 readCorpusInstructions, :265 hashCorpusFiles) and
replay --corpus (replay-command.ts:380). session-run reaches hashCorpusFiles on
a snapshot whose directory branch session-corpus.ts refuseSymlinks already
lstat-checks, so that path is guarded today. corpusReport's directory branch is
reached only by tests, since serve.ts:53 always passes liveCorpusSource().

The directory walk catches a link inside a layout directory only when the walk
runs. Probed: with skills/build/SKILL.md linked outside, corpusReport threw
SymlinkedEntryError naming skills/build/SKILL.md. hashCorpusFiles on the same
file did not, because it never enters the walk.

### The constraint that decides the design

A blanket refusal of a linked instruction file breaks the live corpus. ls -la
~/.claude this session: CLAUDE.md -> /Users/joaofnds/.agents/AGENTS.md, with
agents, rulebook and skills also links into ~/.agents. corpusReport against the
live install returns 123 files today, and a blanket refusal would return zero.

That is the asymmetry checkpoint.ts:115-121 already states and commit 47ed48b
already encodes: only a caller that resolved the root from a trusted location
may say the root is allowed to be a link. decision-4 backs it from the other
side, a declared corpus is data the case ships and versions with itself and
nothing is read from any home directory, while a live corpus is the install on
the running machine. So the guard keys on source.kind, exactly as
corpus-report.ts:85 already does for the layout directories.

### Options considered

1. Do not fix, drop the requirement. Ruled out: the leak is reproduced above and
   it is the same class of defect ACT-113 was filed to close, on paths a case
   author reaches with stale --corpus and replay --corpus. doc-49 section 4
   names it the next obstacle.
2. Guard inside resolveCorpusFile. Ruled out: it is synchronous and does no I/O,
   an lstat would make it async, and calibration.ts:459 calls it only to build a
   display string for the edit prompt and never opens the file. Making that call
   site await an I/O check it does not need is cost for nothing.
3. Guard at the point the bytes are opened, in corpus-file.ts, keyed on
   source.kind, and route corpus-report.ts's instruction-file hash through that
   module instead of joining the path itself. Picked. It puts one rule in the
   module that already owns corpus layout resolution, closes all three sites at
   once, and removes corpus-report.ts's private join, which is what let the file
   drift out of the guard in the first place.

Why 3 wins: it is the only option that closes the two CLI surfaces
(stale --corpus, replay --corpus) as well as the screen, and it deletes a
duplicate path-join rather than adding a fourth refusal site.

### Interrogating the pick

Where it fails: a directory source whose CLAUDE.md is a link to a file *inside*
its own root is refused too, though nothing escapes. Accepted, and it matches
what session-corpus.ts refuseSymlinks already does for the copy path
(doc-8 lines 132-140 records that refusal as correct and says it should stay),
so the harness answers one way rather than two.

What it assumes: that the live install stays trusted. decision-4 states it. If
that ever changes, the guard's condition changes in one place.

What it costs to reverse: one predicate in one module.

What it requires from outside the code: nothing. No caller has to pass a new
argument, because CorpusRoot already carries kind.

### Error type

Throw CorpusFileError, the type corpus-file.ts already exports and already
throws for a path outside the install. Every CLI site that reads a corpus file
already translates it: replay-command.ts:385, stale-command.ts:43,
session-run-command.ts:94, staleness-report.ts:273. A new type would be the
fourth encoding ACT-129 exists to remove; reusing this one leaves ACT-129 with
the same three types it has today rather than four.

Consequence for corpusReport: it will throw CorpusFileError where it throws
SymlinkedEntryError for a linked layout entry, and /api/corpus catches neither,
so both are a 500. That is ACT-130's scope, already filed, and this card does
not widen into it.

### Glossary

No new term. The concepts are corpus source, corpus layout path and live
install, all already defined. Nothing here is a domain term the glossary lacks.

### First test to write

In src/server/corpus-report.test.ts, beside the existing
'refuses a corpus root whose layout directory holds a symlink': a directory
source whose CLAUDE.md is a symlink to a file outside the root is refused, the
failure is a CorpusFileError, its message contains CLAUDE.md, and its message
does not contain the outside file's bytes. It fails today by returning a report
whose CLAUDE.md sha256 is the outside file's.

Then the same shape in src/benchmark/corpus-file.test.ts for
readCorpusInstructions and hashCorpusFiles, and a live-source test asserting a
symlinked instruction file under a source whose kind is 'live' still hashes.

## Review round 1, 2026-09-09, and what it changed

An unprimed reviewer red-teamed the record above and returned two blocking
findings, both of which I reproduced myself before folding. The sections above
are superseded where this one contradicts them.

### Blocking 1: the leak is not only a symlinked file, so lstat is the wrong guard

Reviewer's words: "The leak enumeration misses an intermediate directory
symlink, and the picked approach as described does not close it. A layout
*directory* on the path prefix is also a leak, and it is invisible to an lstat
of the resolved path."

Reproduced by me at 2191223: /tmp/act132f/corpus/skills/build ->
/tmp/act132f/outside/build, with a real SKILL.md inside the outside directory.
hashCorpusFiles(source, ['skills/build/SKILL.md']) returned sha256
243fdb41799f5a01066f9dccca1f0809c52858bed6bf92f3ab9d606f90625922, equal to
shasum -a 256 of the outside file, while lstat of the resolved path reported
isSymbolicLink false. corpusReport refused the same root, because its walk
lstats every component. So the two surfaces already disagree, and a fix built
to lstat the resolved file would leave them disagreeing.

Consequence: the guard is containment of the fully resolved path, not a link
check on the leaf. Every component gets resolved, which an lstat cannot do.

### Blocking 2: the containment comparison has to resolve both sides

Reviewer's words: "If the implementer reaches for realpath to close finding 1
... the existing prefix comparison silently inverts on macOS."

Reproduced by me: realpath('/tmp/act132d/corpus/CLAUDE.md') returns
/private/tmp/act132d/corpus/real.md on this machine, and
startsWith('/tmp/act132d/corpus/') is false. A guard comparing a realpath
against the raw source.root refuses every fixture under /tmp, which is where
this suite's fixtures live.

Consequence: the comparison resolves the root too, and criterion #8 exists to
catch the inversion.

### Should-fix 3: the error type, reversed

Reviewer's words: "The record picks a different error type from the one its own
cited source specifies and never mentions the disagreement." doc-49 section 4
says the refusal should come from "the same named error the walk gives", which
is SymlinkedEntryError.

I checked the consequence the reviewer named: stale-command.ts
refusingCorpusFailures catches CorpusSourceError and CorpusFileError only, and
staleness-report.ts:273 catches CorpusFileError only. So under either type some
catch clause has to change. CorpusFileError would leave one planted link
producing two types across two surfaces (SymlinkedEntryError from the walk,
CorpusFileError from the readers), which is the split ACT-129 exists to remove
and which ACT-129 depends on this card not creating.

Reversed: throw SymlinkedEntryError, and add it to the two catch sites above.
That is criterion #5 and criterion #6.

### The other findings, disposed

- Criteria were duplicated and one pair disagreed on refuse-versus-omit.
  Rewritten as one list, refusal throughout.
- The live count of 123 was pinned as if constant. Rewritten as a baseline to
  re-measure, with the command and date.
- 'reports it exactly as it does today' named no observation. Rewritten as the
  same paths, sha256 values and digest for the same fixture.
- The doc-8 citation for refusing an inside-pointing link was stretched: its
  subject is a chezmoi render, and that source was dropped by ACT-66. Dropped
  as precedent. The behavior stands on its own ground: a resolved path inside
  the root passes containment, so an inside-pointing link is followed, not
  refused. This reverses what 'Interrogating the pick' above accepted, and it
  is the better answer, since nothing escapes and refusing it would cost a
  corpus the ability to link within itself.
- corpusReport's directory branch being 'reached only by tests' is a property
  of serve.ts:53, not of the type, which admits kind 'directory'. Noted.
- The live exemption holds for a stronger reason than the record gave: every
  kind 'live' root in non-test source is built from liveCorpusRoot(), so no
  caller-supplied string can claim the exemption. Verified by grep
  'kind: \"live\"' over src excluding tests.

### The pick, restated

Guard containment of the resolved path in corpus-file.ts, at the point the
bytes are opened, keyed on source.kind, and route corpus-report.ts's
instruction-file hash through that module instead of joining the path itself.
A directory source resolves the candidate path and the root and refuses when
the resolved path is not under the resolved root. A live source is exempt, as
it already is for the layout directories.

Not lstat, because blocking 1 shows lstat misses an intermediate directory
link. Not the existing lexical confinedTo prefix test alone, because it never
resolves a link at all.

### First test to write, revised

In src/benchmark/corpus-file.test.ts: hashCorpusFiles on a directory source
whose skills/build is a symlink to an outside directory holding a real
SKILL.md is refused with SymlinkedEntryError. It fails today by returning
sha256 243fdb41799f5a01066f9dccca1f0809c52858bed6bf92f3ab9d606f90625922. That
one is first because it is the case the superseded design would have shipped
broken.

Then the leaf-link cases for CLAUDE.md and a declared layout file, the relative
link, the symlinked-parent fixture that must still pass, and the live-source
case.

### The revised design, probed 2026-09-09

A throwaway containment predicate (realpath both sides, then compare with a
trailing separator) run against the four directory fixtures and the live root:

- leaf link out of the root: outside, refused. correct
- intermediate directory link out of the root: outside, refused. correct, and
  this is the case blocking finding 1 named
- link pointing inside the root, under a symlinked /tmp parent: inside,
  allowed. correct, and this is the case blocking finding 2 named
- plain real path: inside, allowed
- ~/.claude/CLAUDE.md against root ~/.claude: OUTSIDE

The last one is the load-bearing observation: the live install's instruction
file resolves into ~/.agents, so the live exemption is not a courtesy, it is
required or every live run loses its instructions. Criterion #9 is what holds
it.

Not probed, left for build: whether resolving the root once per call is worth
caching, and how the two catch sites read once SymlinkedEntryError reaches
them.

Oversight probe, 2026-09-09, on the shape stage's claims. Two held, one is narrower than written.

Held: realpath rewrites /tmp to /private/tmp on this machine, so a containment check that resolves only one side rejects every fixture under /tmp. Held: a layout directory that is itself a symlink hands over a regular file inside it, and a per-file link check on that file reports nothing, so a naive guard would miss it.

Narrower than written: that intermediate-directory case does NOT leak on a directory corpus today. hashDirectory refuseIfLink (checkpoint.ts:100-105) already throws SymlinkedEntryError for it before reading anything inside, observed on a corpus whose agents/ linked outside. It leaks only on kind 'live', where hashCorpusLayout passes rootMayBeALink true and the refusal is deliberately switched off; observed on the same layout, where the outside file was reported as agents/rule.md with its outside bytes.

This matters for the exemption decision. The stage exempted the live corpus because ~/.claude/CLAUDE.md is a symlink into ~/.agents, which is sound for the instruction file. But the same exemption is what opens the intermediate-directory leak, so 'live is exempt' and 'the intermediate case is closed' cannot both be true as stated. The containment check is what reconciles them: a live corpus may follow a link, and what it follows to must still resolve inside the corpus's own resolved root. Build against that, and let the first test be the live intermediate case rather than the directory one, which already passes.
<!-- SECTION:NOTES:END -->
