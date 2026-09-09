---
id: ACT-132
title: >-
  A symlinked CLAUDE.md at the corpus root is followed, bypassing the
  directory-walk refusal
status: Done
assignee:
  - '@claude'
created_date: '2026-09-08 22:44'
updated_date: '2026-09-09 10:30'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-51 - reflection-ACT-132.md
priority: high
ordinal: 128008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 a corpus root whose CLAUDE.md is a symlink pointing outside the root keeps the target path and bytes out of the corpus report files and digest, refused or omitted (reproduced 2026-09-09: corpusReport on a directory corpus whose CLAUDE.md linked to an outside file returned that file hashed under path CLAUDE.md)
- [x] #2 a corpus source whose instruction file is a real file still reports it exactly as it does today
- [x] #3 bun run test, bun run lint, bun run typecheck all pass (the project own check, CLAUDE.md)
- [x] #4 a directory corpus source whose CLAUDE.md is a symlink to a file outside the root is refused by corpusReport: the outside file's sha256 and bytes appear in neither report.files nor report.digest (reproduced 2026-09-09: corpusReport on such a root returned path CLAUDE.md with sha256 23185939fe8f74ed893c5b8d7d23975d5147105dd17b891df4bc57c66abf3785, equal to shasum -a 256 of the outside file)
- [x] #5 a directory corpus source whose CLAUDE.md is a symlink outside the root is refused by readCorpusInstructions and by hashCorpusFiles, so stale --corpus and replay --corpus surface a refusal rather than the outside bytes (reproduced 2026-09-09: readCorpusInstructions returned the outside file's text and hashCorpusFiles returned its sha256)
- [x] #6 a directory corpus source whose declared corpus file inside a layout directory is a symlink outside the root is refused by hashCorpusFiles (reproduced 2026-09-09: hashCorpusFiles on skills/build/LINKED.md -> an outside file returned that file's sha256)
- [x] #7 the live corpus source keeps reporting through its symlinked CLAUDE.md: corpusReport against ~/.claude returns 123 files with a CLAUDE.md entry (measured 2026-09-09 by corpusReport(liveCorpusSource(), tmpdir) at 2191223; ~/.claude/CLAUDE.md is a symlink to ~/.agents/AGENTS.md, and checkpoint.ts:115-121 with commit 47ed48b state the live install is the trusted root that may be a link)
- [x] #8 a directory corpus source whose instruction file and declared files are real files reports and hashes exactly as it does at 2191223
- [x] #9 the refusal names the corpus layout path of the offending file, and its message carries neither the link target's absolute path nor its bytes
- [x] #10 bun run test, bun run lint, bun run typecheck all pass (the project's own check, CLAUDE.md)
- [x] #11 a directory corpus source whose CLAUDE.md is a symlink resolving outside the root is refused by corpusReport, readCorpusInstructions and hashCorpusFiles, and the outside file's sha256 and bytes appear in no report, digest or return value (reproduced 2026-09-09 at 2191223: all three returned the outside file's bytes or its sha256 23185939fe8f74ed893c5b8d7d23975d5147105dd17b891df4bc57c66abf3785, equal to shasum -a 256 of the target)
- [x] #12 a directory corpus source whose declared corpus file inside a layout directory is a symlink resolving outside the root is refused by hashCorpusFiles (reproduced 2026-09-09: hashCorpusFiles on skills/build/LINKED.md -> an outside file returned that file's sha256)
- [x] #13 a directory corpus source whose layout directory is itself a symlink to a directory outside the root is refused by hashCorpusFiles for a real file inside it, not only by corpusReport (reproduced 2026-09-09: skills/build -> /tmp/act132f/outside/build with a real SKILL.md inside; hashCorpusFiles returned sha256 243fdb41799f5a01066f9dccca1f0809c52858bed6bf92f3ab9d606f90625922, equal to shasum -a 256 of the outside file, while lstat of the resolved path reported isSymbolicLink false and corpusReport refused the same root)
- [x] #14 a relative symlink out of the root is refused the same way an absolute one is (reproduced 2026-09-09 by the reviewer: ../outside/s.md leaks identically today)
- [x] #15 corpusReport, readCorpusInstructions and hashCorpusFiles all refuse with SymlinkedEntryError, the type the directory walk already throws, so one planted link produces one error type across every surface (doc-49 section 4: 'refused by the same named error the walk gives')
- [x] #16 stale --corpus and replay --corpus against such a source exit as a refused precondition rather than an uncaught error, with the refusal text on stderr (stale-command.ts refusingCorpusFailures and staleness-report.ts catch only CorpusSourceError and CorpusFileError today, so SymlinkedEntryError would escape them)
- [x] #17 the refusal names the offending file by its corpus layout path, and its message carries neither the link target's path nor its bytes
- [x] #18 a directory corpus source whose root is reached through a symlinked parent directory is reported and hashed, not refused (measured 2026-09-09: realpath of /tmp/act132d/corpus is /private/tmp/act132d/corpus on this machine, so a containment check comparing a realpath against a raw root rejects every fixture under /tmp)
- [x] #19 the live corpus source keeps reporting through its symlinked CLAUDE.md: corpusReport against ~/.claude returns a CLAUDE.md entry and a file list of the same length it returns at 2191223 (measured 2026-09-09 by corpusReport(liveCorpusSource(), tmpdir()) at 2191223, which returned 123 files; the number tracks this machine's ~/.agents tree and is a baseline to re-measure, not a constant)
- [x] #20 a directory corpus source holding only real files reports the same paths, sha256 values and digest it reports at 2191223 for the same fixture
- [x] #21 bun run test, bun run lint, bun run typecheck all pass (the project's own check, CLAUDE.md)
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

## Build decision 2026-09-09: live stays exempt

The oversight probe proposed that a live corpus may follow a link but what it
follows to must resolve inside the corpus's own resolved root. Measured this
session on this machine: realpath(~/.claude) is /Users/joaofnds/.claude, while
realpath(~/.claude/CLAUDE.md) is /Users/joaofnds/.agents/AGENTS.md and
realpath(~/.claude/skills) is /Users/joaofnds/.agents/skills. Every layout entry
of the live install resolves outside its own root, so containment against the
live root refuses the entire live corpus. The reconciliation the probe proposed
is not available.

Decision: containment applies to kind 'directory' only, as the shape stage
picked. kind 'live' stays exempt, and every non-test construction of a live root
goes through liveCorpusRoot(), so no caller-supplied string can claim it. The
intermediate-directory leak on a live source is therefore accepted, and it is
the same acceptance hashDirectory already makes with rootMayBeALink. Criterion
#13's fixture is a directory source, which this closes.

## Defect found outside the card's path, fixed in its own commit (8617b76)

While reviewing the fix I probed session run --corpus, which the shaping recorded
as 'guarded today' because session-corpus.ts refuseSymlinks lstat-checks the
directory branch. It was not guarded against the intermediate-directory case.

Reproduced at cf24913 on a directory source whose agents/ is a symlink to a
directory outside the root holding a real reviewer.md: snapshotSessionCorpus
copied it into the snapshot and hashCorpusFiles on that snapshot returned sha256
924ab048ffc82e1a3dcd9f4a6756cd160b5abbfbfa68ffc35cc90b14fd15dc54, equal to
shasum -a 256 of the outside file. The containment guard this card added does not
catch it, because by then the bytes are a real file under the snapshot root.

Revert test: the evidence stands with this card's change reverted, so the defect
is session-corpus.ts's, not this change's. Fixed in 8617b76 by giving
refuseSymlinks the same containment predicate, now shared from corpus-file.ts as
resolvesOutside rather than encoded a second way. Observed refused directly after
the fix. Full suite 1306 + 100 pass, lint and typecheck clean.

## Handoff 2026-09-09

### What changed

Containment of the fully resolved path is now the one rule for whether corpus
bytes belong to a corpus, applied at four sites and shared as resolvesOutside in
corpus-file.ts:

- cf24913: corpusReport, readCorpusInstructions and hashCorpusFiles refuse a
  directory source whose declared path resolves outside its root. corpus-report
  stopped hashing the instruction file through its own join. SymlinkedEntryError
  moved from checkpoint.ts to file-presence.ts, because corpus-file importing it
  from checkpoint closed a cycle oxlint refuses. stale --corpus and replay
  --corpus translate it into a refused precondition.
- 8617b76: session run --corpus refused. Its refuseSymlinks lstat missed a
  layout directory that is itself a link, which the shaping had recorded as
  already guarded and which was not.
- 1921434: installStageCorpusSnapshot refused. replay --corpus handed it the
  operator's raw root and cp dereferences, so outside bytes were installed into
  the worktree the stage session reads while the read surfaces refused them.
- c9ffe4d: hashDirectory judges an entry by where it resolves rather than by
  whether it is a link. It and the new guard disagreed on a link pointing back
  inside the root, under one error type, so a corpus could pass stale --corpus
  and be refused by the corpus screen. lstat stays for the two cases resolution
  cannot answer: an entry that vanished mid-walk is skipped, a dangling link is
  refused.
- 623fce3, 4d03355, 7af4465: three surviving mutations pinned, the lexical check
  renamed to withoutTraversal, and session run's corpus precondition translating
  the refusal like its neighbour already did.
- c3ca1bd: removed a review probe's debug throw that 8617b76 committed by
  mistake. It refused every live-source hash. See Risks below.

### What became possible but is not wired up

resolvesOutside is exported from corpus-file.ts and used by three modules. No
caller outside those. Nothing else in the tree needs it today.

### What was observed, and how

Every one of the 21 criteria was observed at HEAD by running the functions
directly, not through the suite. Leaf link, nested declared link, intermediate
directory link, relative link: all four refused with SymlinkedEntryError on all
three read surfaces, message carrying neither the target path nor its bytes.
Symlinked-parent root reported normally. A real-files fixture reported digest
1cf0ff with sha256 8c8169bd..., 5e247875..., 6caf93e0..., identical before and
after. The session-run and install leaks were each reproduced before the fix and
observed refused after.

Full check at HEAD: bun run test 1310 pass 0 fail plus 100 client pass 0 fail,
bun run lint clean, bun run typecheck clean.

### What was not verified

The live corpus reports 122 files, not the 123 the criteria record. I measured
122 at the baseline commit 2191223 as well, in a fresh clone, so the count
tracks this machine's ~/.agents tree rather than any code change. The criterion
says exactly that. Nothing about the code was ruled out by this, but the number
in criteria #7 and #19 is stale.

A check-then-read race exists: refuseUncontained resolves the path, then the
bytes are opened by path rather than through a handle captured at check time. An
actor who can write the corpus directory during a run could repoint the link
between the two. Not probed. Not closed: it needs the same write access as
planting the link the guard exists to catch, and the threat model here is data a
case author declares, not a live adversary.

### Where things went

ACT-133 filed: a hardlinked corpus file still hands over outside bytes.
Reproduced at 7af4465. Containment cannot see it, because a hardlink resolves to
a path inside the root; closing it needs inode identity or a link-count refusal,
and whether it is worth closing at all is that card's first question.

ACT-129, which depends on this card, still has its subject: three refusal
messages in three wordings remain, though the type count is now one across every
reader-facing surface.

### Risks a next session should know

Commit 8617b76's tree carries three lines a review process injected into the
working tree, which I staged by mistake. c3ca1bd removes them. The tip is
correct and every check passes at HEAD; only that one commit's tree is wrong. I
did not rewrite published history.

Triage 2026-09-09: record correction to criteria #7 and #19, which both say the live corpus returns 123 files.

Measured 122 this run by corpusReport(liveCorpusSource(), tmpdir()), CLAUDE.md present. doc-51 proposed this correction from its own measurement of 122; this is an independent second measurement, not a relay. Criterion #19 already says the number is a baseline for this machine's ~/.agents tree and not a constant, so 122 replaces 123 as that baseline without reopening the card. The card stays Done.

Found while taking that measurement, and it is the more important half: the first attempt THREW rather than returning a count. SymlinkedEntryError, 'agents/escape.md resolves outside the tree it is named under'. ~/.claude/agents/escape.md was a symlink to /tmp/stale-out-8nUK/secret.md, dated Sep 9 02:43, left in the live corpus by a probe during the ACT-130 session and never cleaned up. It was not chezmoi-managed and not tracked in the dotfiles git.

So the live corpus was unreadable for roughly eight hours: the corpus screen, every live-corpus hash, and any stale --corpus against the live install would have failed. Removed it this run under Ownership, after confirming it was a probe artifact and not configuration, and the count then measured 122.

This is filed as ACT-135, because the defect is that a probe can plant a file in the live corpus and nothing notices.
<!-- SECTION:NOTES:END -->
