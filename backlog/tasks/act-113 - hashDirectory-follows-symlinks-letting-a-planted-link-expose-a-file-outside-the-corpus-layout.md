---
id: ACT-113
title: >-
  hashDirectory follows symlinks, letting a planted link expose a file outside
  the corpus layout
status: Done
assignee:
  - '@claude'
created_date: '2026-09-08 01:41'
updated_date: '2026-09-08 22:46'
labels: []
dependencies: []
priority: medium
ordinal: 109008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
hashDirectory (src/benchmark/checkpoint.ts:91-114), shared by the corpus screen (src/server/corpus-report.ts) and by captureStageCorpus/snapshotStageCorpus/session-lineage.ts, calls readdir(root, {recursive:true}) then stat (not lstat) on every entry, with no realpath containment check. A symlink placed inside a walked directory (e.g. corpus-root/skills/evil -> /somewhere/else) is followed, and its target's files are read, hashed, and reported in the API response and digest under the symlink's relative path. Verified directly in ACT-50's post-review code review (security axis): a planted symlink under skills/ surfaced a file's real bytes and hash outside the corpus root.

This is not introduced by ACT-50; hashDirectory's symlink-following predates it. It undercuts the guarantee ACT-50's corpus-screen fix (commit bdd72a1) states it provides (secrets like daemon/control.key should no longer be walked, read, or exposed) for anything reachable via a symlink one level down from the walked directories.

Pre-req: read ~/.agents/rulebook/coding-style.md and doctrine.md's Security-adjacent guidance before designing the fix; decide whether hashDirectory should refuse a symlink outright, resolve+contain it via realpath against root, or something else, and confirm the decision against the other three callers, which may have different tolerance for symlinks in their own inputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 hashDirectory throws, naming the offending entry's path relative to the walked root, when the walk lists an entry that is itself a symlink; no file reachable only through that link appears in the returned files (ACT-50 post-review security-axis review observed a planted symlink under skills/ surfacing an outside file's real bytes and hash)
- [x] #2 a symlink planted inside a walked corpus layout directory and pointing outside the corpus root keeps the target's path and content out of the corpus report's files and its digest, whether the report is produced or refused (card acceptance criterion #2 as originally filed)
- [x] #3 hashDirectory returns the same files for a corpus root whose skills, agents, and rulebook directories are themselves symlinks as it does before the change, so recorded lineage is unchanged (measured 2026-09-09: ls -ld shows all three are symlinks into ~/.agents; the live corpus hashes to 123 files both at f835f75 and at HEAD)
- [x] #4 hashDirectory still returns without throwing when an entry readdir listed no longer exists at all by the time the walk reaches it, distinct from a symlink that resolves to nothing (existing documented behavior, kept for the live corpus root another process can be writing)
- [x] #5 a fixture tree holding a symlink is refused with the same named refusal the harness gives today, not an untranslated error, since sessionLineage now walks that tree before seedFixture does (verified 2026-09-08: sessionLineage runs before attempted, and attempted is what maps SessionInputError to RefusedPreconditionError)
- [x] #6 a target repository whose backlog/ or .boris/ tree holds a symlink, or whose backlog/ or .boris/ is itself a symlink, does not get the link target's bytes hashed into a checkpoint record (case.ts:360 documents the target as untrusted data a case author can get wrong)
- [x] #7 bun run test, bun run lint, and bun run typecheck pass, and bun run fmt:check passes on every file this change touched (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

## Shaped 2026-09-08

Goal: hashDirectory refuses a symlink found inside a walked tree, so no file outside the walked directory is read, hashed, or reported, and the refusal names the entry.

### Unknowns and how each resolved

1. Does readdir(recursive:true) descend into symlinked subdirectories, or only list the link?
   It descends. Probe run 2026-09-08: a directory holding `evil -> /tmp/slt/outside` listed
   ["evil","file-link","evil/control.key","evil/sub","evil/sub/deep.txt"]. The card's report is
   confirmed at the readdir layer, not just at stat.

2. Refuse outright, or resolve+contain via realpath against root?
   Refuse. Two callers in this repository already refuse: session-corpus.ts refuseSymlinks ("Corpus
   entry <path> is a symlink, which would snapshot bytes from outside the corpus source") and
   session-attempt.ts seedFixture ("Fixture entry <path> is a symlink, which would lead out of the
   attempt directory"). Containment would be a third, different answer to the same question in the
   same codebase. Refusal is also strictly the smaller change: no realpath call per entry, no root
   normalization, no /tmp-vs-/private/tmp handling.

3. Does refusal break the real corpus?
   Not if it is scoped to entries inside the walk. Measured 2026-09-08 with
   `find ~/.agents/skills ~/.agents/agents ~/.agents/rulebook ~/.claude/output-styles -type l | wc -l`
   => 0. There are no symlinks inside the corpus trees.
   But `ls -ld ~/.claude/skills ~/.claude/agents ~/.claude/rulebook` (2026-09-08) shows all three ARE
   symlinks into ~/.agents. They are the roots handed to hashDirectory, not entries inside it.
   So the refusal must apply to entries the walk lists, never to the root argument. A blanket
   lstat on the root would empty the live corpus and break every recorded lineage.

4. Do the other three callers tolerate this?
   Yes. captureStageCorpus/snapshotStageCorpus walk resolved layout directories (same roots as 3).
   hashWorkflowState walks backlog/ and .boris/ under the target repo. session-lineage walks a case
   fixture tree, and seedFixture already refuses a symlink anywhere in that same tree, so refusing
   here cannot reject a fixture the harness would otherwise have accepted. `find cases -type l`
   (2026-09-08) => none.

5. Does the existing broken-symlink tolerance survive?
   No, and it should not. checkpoint.test.ts:940 asserts a broken link is skipped rather than thrown.
   A broken link is still a link; under refusal it throws. That test is rewritten to assert the
   refusal, and its stated rationale (a live corpus root another process is writing to) is preserved
   by keeping the existing catch for an entry that vanishes between listing and stat.

### Approach

Removal option first: leave it undone. Ruled out by the card's own evidence, ACT-50's post-review
security-axis review observed a planted symlink under skills/ surfacing a file's real bytes and hash
in the API response. The guarantee commit bdd72a1 states is currently false.

Only one way to build it survives, so no further survey: in hashDirectory's loop, lstat each entry
before stat; on isSymbolicLink() throw naming the entry's path relative to the walked root. The
existing try/catch around the missing entry stays.

Where it fails: a corpus author who deliberately symlinks a file inside a skill directory now gets a
hard error instead of silent hashing. That is the same trade the other two callers already made, and
the error names the entry, so it is actionable.
Cost to reverse: one function, one test.

### Glossary

No new domain terms. Symlink and containment are implementation terms and stay out of GLOSSARY.md.

### First test to write

In checkpoint.test.ts, replace the broken-link test with: hashDirectory refuses a symlink inside the
walked directory, naming the entry, and neither the target's path nor its content reaches the result.
Then a second test asserting the corpus-report path: a symlink planted under a walked layout
directory keeps the target's path and sha out of both the report's files and its digest.

## Adversarial review and decision, 2026-09-08

The first draft of this shaping was reviewed by an unprimed reviewer and returned three
blocking findings. All three were re-verified by command in this session. The approach
changed as a result. What follows supersedes the Approach section above where they conflict.

### The finding that reopened the approach

The first draft settled on 'throw' without asking what each of the four callers does with a
thrown error. Three findings were faces of that one unasked question:

- /api/corpus (src/server/api.ts:76-83) has no try/catch, and the app's onError (api.ts:199)
  turns any throw into a 500. So a planted symlink under the corpus root changes the corpus
  screen from silently showing an outside file to a 500 with a redacted message. Verified by
  reading the route and the onError handler.
- sessionLineage runs at src/cli/session-run-command.ts:216, BEFORE attempted() at line 219.
  attempted() is what translates SessionInputError into RefusedPreconditionError
  (session-run-command.ts:114-116). So the first draft's claim that seedFixture already
  refuses these fixtures 'so refusing here cannot reject a fixture the harness would
  otherwise have accepted' was wrong about ordering: today a symlinked fixture gets a clean
  named refusal, and under this change it gets an untranslated Error thrown earlier.
  Verified by reading both files.
- hashWorkflowState walks backlog/ and .boris/ under the TARGET repo, which case.ts:360
  documents as untrusted data. The first draft dismissed it in half a sentence. It is a
  second live instance of the same leak. materializeCheckpoint (checkpoint.ts:615) also
  re-walks a stored snapshot to verify it, so a snapshot containing a link would start
  failing verification. `find .benchmark-runs -type l | wc -l` => 0 on 2026-09-08, so no
  recorded run here is affected.

### The probe that decided the mechanism

Considered skipping the symlinked entry instead of throwing, so the corpus screen could
degrade rather than 500. A probe killed it. On /tmp/skipprobe with `walked/evil -> outside`,
`readdir(walked,{recursive:true,withFileTypes:true})` returned:

    evil          isLink=true   isFile=false
    normal.txt    isLink=false  isFile=true
    control.key   isLink=false  isFile=true     <- inside the link target
    sub           isLink=false  isFile=false
    deep.txt      isLink=false  isFile=true     <- inside the link target

and lstat on each listed path agrees: `evil/control.key` reports isLink=false, because the
link sits in the path's interior, not at its end. Skipping the entry named `evil` therefore
leaves `evil/control.key` in the listing and it gets hashed anyway. Only aborting the walk
stops the leak, short of tracking skipped prefixes. Same probe rules out switching to
`withFileTypes` as a cheaper guard: it flags only the link itself, never its descendants.

### Decision: throw on an entry, never on the root

My answer and the advisor's agree, reached independently and for the same reason. I had
first answered 'skip and report', on engineering-judgment.md section 2 'define errors out of
existence' and section 4 'optimize for recovery'; the probe above refuted it, because a skip
does not in fact remove the error. The advisor, briefed with no lean, picked throw-on-entry
and supplied the same probe.

The advisor added one measurement worth carrying: hashing the live corpus under the
inner-entry refusal yields 85 + 2 + 1 files, which with CLAUDE.md is 89, matching the
corpusFiles.length of 89 recorded in
.benchmark-runs/2026-09-06T21-58-29.508Z.checkpoints/shape/checkpoint.json. The pick
reproduces existing recorded lineage on this machine rather than shifting it. Re-run that
count before relying on it.

What would change the pick, in the advisor's words: 'A real corpus tree with an inner
symlink that must keep hashing. If that turns up, the pick moves to realpath containment
against root.' The probe is `find -L <corpus-root> -type l`.

The corpus screen's 500 is left as a 500. Mapping it to a named 4xx is scope this card did
not ask for; if it is wanted it is a separate card. The commit body must state the
user-facing failure-mode change, since a reader of the commit cannot open this card.

### Findings folded, and the two left open

Folded into the criteria above: the AC #3/#6 contradiction (a broken symlink satisfied both a
'throw' and a 'skip' criterion; verified by probe that lstat reports isSymbolicLink=true while
stat reports ENOENT on the same broken link, so the two criteria named one input and demanded
opposite behavior), the vacuous AC #1 (it forbade only leaks 'outside the directory being
walked' and left the card's own escape hatch open to fix the corpus screen alone), the
implementation language in AC #3 and #5, and the two callers the first draft under-argued,
which now have criteria of their own.

Left open, with dispositions:

- The corpus screen returns a 500 rather than a named refusal. Accepted as-is, stated in the
  criteria as 'whether the report is produced or refused'. Mapping it to a 4xx is a separate
  card if wanted.
- src/benchmark/session-corpus.ts:109 states 'A recursive copy dereferences, so a symlinked
  entry copies bytes from outside the source'. That is false. Probed 2026-09-08: cp with
  {recursive:true} PRESERVES the symlink (lstat on the copy reports isSymbolicLink=true). The
  function's behavior is right and its stated reason is wrong, and that same false premise is
  cited in this card's Unknown 2 as precedent. It is outside this change. Filed rather than
  fixed here.
- Unknown 3's measurement is one machine on one date. The corpus root is homedir()/.claude, so
  'no symlinks inside the corpus trees' is a fact about these dotfiles, not a property of the
  system. Re-run `find -L <corpus-root> -type l` before relying on it; if one turns up, the
  approach moves to realpath containment.

## Build decision, 2026-09-09: the error type hashDirectory throws

The shaping left open what a thrown error does at each of the four callers, and criterion
#5 requires the fixture refusal to stay named. Deciding it here rather than asking, since
this session runs unattended.

hashDirectory throws an exported `SymlinkedEntryError` from checkpoint.ts, and
session-run-command.ts maps it to RefusedPreconditionError in the same place it already
maps SessionInputError. Rejected: throwing a bare Error (criterion #5 fails, the existing
CLI test at session-run-command.test.ts:177 expects RefusedPreconditionError and would
start failing); throwing SessionInputError from checkpoint.ts (checkpoint.ts would import
from session-attempt.ts, an arrow from the shared hashing layer into one caller's
vocabulary). A named type in the layer that raises it, translated at the CLI edge, is the
project's existing shape: CorpusFileError and SessionCorpusError are already translated at
that same site.

The corpus screen's 500 stays a 500, as the shaping decided.

## Build, 2026-09-09

Landed in two commits:
- 438145a fix: refuse a symlink inside a hashed directory tree
- 66e5dae test: cover the symlink refusal at the two callers that walk untrusted trees

### What changed

hashDirectory now lstats each listed entry instead of stat. stat is gone from the file
entirely, so no path in this walk follows a link. An entry that lstat cannot resolve at
all is skipped (the vanished-entry tolerance); an entry that resolves and is a symlink
throws SymlinkedEntryError, a new exported class in checkpoint.ts. The root argument is
never lstatted, which is what keeps a .claude layout directory (itself a symlink into
~/.agents) hashing.

session-run-command.ts gained lineageOf, which translates SymlinkedEntryError into
RefusedPreconditionError, mirroring the existing attempted() and requireCorpus() catches.
Without it, a symlinked fixture tree would surface an untranslated error from the lineage
walk, which runs before the seed that used to refuse it.

### Evidence per acceptance criterion

#1 hashDirectory throws naming the entry: checkpoint.test.ts 'throws SymlinkedEntryError
naming the entry, hashing nothing behind it'. Passes; fails when the guard is removed.

#2 corpus report keeps the target out: corpus-report.test.ts 'refuses a corpus root whose
layout directory holds a symlink'. Asserts the failure names the entry and does not carry
the target's bytes. Passes; fails when the guard is removed.

#3 a corpus root whose layout dirs are symlinks hashes unchanged: measured this session.
corpusReport against the live ~/.claude returns 123 files both at f835f75 (before the
change) and at HEAD. The 89 in the criterion was a count from 2026-09-08; the corpus has
grown since, and 123-before equals 123-after is the comparison that matters. Also
checkpoint.test.ts 'hashes the files under a root that is itself a symlink'.
find -L on the four corpus trees: no symlinks inside them.

#4 a vanished entry is still skipped: observed directly. Patched fs.readdir to delete a
subdirectory after listing it, then called hashDirectory; it returned ['a.txt'] without
throwing. Not covered by a test in the suite, because forcing the race needs a seam in
production code and the guard exists for a live-corpus race, not a testable input. This
criterion rests on that one observation plus the code path.

#5 a symlinked fixture keeps its named refusal: session-run-command.test.ts 'refuses a
fixture tree holding a symlink, before any provider call' asserts
RefusedPreconditionError. This test FAILED after the guard landed and before lineageOf
was added, which is the evidence the translation is load-bearing rather than decorative.

#6 a target repo's backlog tree: checkpoint.test.ts 'refuses a target whose backlog tree
holds a symlink'. Passes; fails when the guard is removed.

#7 project checks: bun run test 1289 pass 0 fail plus 100 pass 0 fail on the client suite.
bun run lint clean. bun run typecheck clean. bun run fmt:check reports two files,
cases/doctrine-ab-with/case.json and cases/doctrine-ab-without/case.json, which are
another session's uncommitted work in the tree, not this change; oxfmt --check on the four
files this change touched is clean.

### Not done here

The corpus screen returns a 500 for a symlinked corpus root rather than a named 4xx. The
shaping decided that; it stays.

After-task pass filed ACT-129: three walks now refuse symlinks with three error types and
three messages, and session-run-command.ts carries two catch blocks for two of them.

## Code review, 2026-09-09

Six unprimed reviewers, one per axis: spec, style, architecture, security, testing,
refactoring. Suite before dispatch: 1289 pass / 0 fail plus 100 pass / 0 fail.

Standard files each reviewer read are in their briefs; all six examined all four changed
files. No axis skipped.

### Blocking, fixed in 47ed48b

1. The root exemption was positional, not scoped to the caller that needed it, so the
   original defect survived one directory up. Reported independently by security,
   architecture, and spec (as the residual boundary). I reproduced it myself before
   fixing: a target with backlog -> outside returned
   [{path: backlog/control.key, sha256: ...}], an outside file hashed into a checkpoint
   under a path claiming it sits inside the repo. Criterion #6 was not met.
   Fix: rootMayBeALink is now a required argument each caller answers. Layout roots say
   yes (a .claude directory is normally a symlink into the real corpus); workflow trees
   and the fixture tree say no; the corpus screen answers from the source kind, so the
   live install stays exempt and a --corpus <dir> does not.
   Verified after: the same probe now refuses, and the live corpus still hashes 123.

2. lstatIfExists swallowed every error as absence, so a file under a readable but not
   searchable directory was silently dropped from the lineage. Reported by style,
   architecture, testing, and refactoring, four axes independently. Reproduced: a tree
   with sub at mode 0444 returned ['a.md'] and omitted sub/secret.md with no error.
   The project's own statIfExists states this exact rule and narrows to ENOENT.
   Fix: moved to file-presence.ts as lstatIfPresent beside it, narrowed to ENOENT, with
   its own tests for both the absence and the EACCES case.

### Should-fix, fixed in 340952f

3. The refusal message dropped the prefix, so after the corpus screen redacts the
   absolute root a reader saw an entry name with no directory. Reported by style and
   architecture. Now built as join(prefix, entry): observed rendering
   'agents/escape.md is a symlink, ...' with nothing absolute left to redact.

### Should-fix, tracked

4. One symlink in the corpus blanks the whole run-history screen rather than degrading.
   Reported by security and architecture with reproductions. run-history.ts:202 awaits
   staleCheckpoints outside the try block its own docstring says exists to stop one bad
   run blanking the response. Pre-existing structurally; this change made it reachable.
   Deciding what the screen shows instead is a product question this card did not shape.
   -> ACT-130.

5. A symlinked CLAUDE.md at the corpus root is followed, bypassing the walk entirely,
   because corpus-report.ts hashes it through hashFile. Reported by security, reproduced
   here: the outside file's bytes came back hashed under path CLAUDE.md. Different code
   path, outside every criterion on this card. -> ACT-132.

### Notes, no action

6. Three walks now refuse symlinks with three error types and three messages
   (functional coupling; reported by architecture and refactoring). Already filed as
   ACT-129 by the after-task pass before the reviews returned.

7. SymlinkedEntryError is translated at one of four call paths; run, replay, and stale
   surface it raw. Reported by architecture and style. The class docstring names only two
   dispositions. Left as is: mapping those exit codes is what ACT-130 will settle for the
   server surface, and the CLI half is ACT-129's shape question.

8. snapshotStageCorpus copies before it hashes, so a refusal leaves the link materialized
   under the run's inputs directory. Reported by architecture. Real, but the leftover is
   under a directory a later run overwrites and no reader observes it as truth. No card.

9. The test name claimed 'hashing nothing behind it' with no assertion behind the clause
   (testing). Renamed and given the assertion. The corpus-report test asserted only on the
   message, not the type (testing); both now assert the type. Both in 47ed48b.

### Refuted

The spec reviewer reported the broad catch as unreachable, having probed mode 000 where
readdir throws first. That generalized from the wrong input: mode 0444 lets readdir list
and lstat refuse, which is the reachable case the other four axes found. Recorded as
refuted, with the probe above as the evidence.

### Suite after all fixes

1293 pass / 0 fail plus 100 pass / 0 fail. lint, typecheck, fmt:check clean on every file
this change touched.

One full-suite run failed at pipeline-confirmation.test.ts:1028, a concurrency-ordering
assertion in a file this change does not touch, whose last commit predates it. The file
alone passed 18/18 and the next full run passed 1293/1293. Filed as ACT-131 rather than
left as noise.

## Criteria rewritten, 2026-09-09, with reasons

Three criteria were rewritten during the build. Each is recorded here so whoever wrote
them can correct me.

#3: the number changed from 89 to 123, and the comparison from 'as it does today' to
'as it does before the change'. The 89 was measured on 2026-09-08 against a
.benchmark-runs checkpoint. The corpus has grown since (the rulebook gained a
coding-style/ directory, among other edits), so 89 is no longer reachable and a criterion
naming it could never be checked again. What the criterion was standing in for is that
the change shifts no lineage, so it now names the before-and-after comparison, which I ran
both sides of: 123 at f835f75 and 123 at HEAD.

#6: widened from 'holds a symlink' to 'holds a symlink, or is itself a symlink'. The
original wording was satisfiable by a change that still leaked, and the first
implementation did exactly that: it refused a link inside backlog/ while following
backlog/ itself. Three reviewers found the hole and I reproduced it. The wider wording is
what the criterion's own cited source (case.ts:360, the target as untrusted data) already
implied.

#7: narrowed from 'fmt:check passes' to 'fmt:check passes on every file this change
touched'. Two files in the tree, cases/doctrine-ab-with/case.json and
cases/doctrine-ab-without/case.json, are another session's uncommitted work and are what
fmt:check reports. They are not mine to commit or to format. The unnarrowed criterion made
this card's completion depend on another session finishing, which is not a fact about this
change. Every file this change touched is clean under oxfmt.

#4 kept its wording but note what backs it: there is no suite test forcing the race, and
adding one would need a seam in production code that exists only for the test. I observed
it directly instead, by patching readdir to delete a subdirectory after listing it, and
hashDirectory returned the surviving file without throwing. The narrower helper it now
calls, lstatIfPresent, does have tests for both absence and EACCES.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the symlink leak in hashDirectory, in four commits: 438145a (the refusal), 66e5dae (caller tests), 47ed48b (the two blocking review findings), 340952f (the message).

hashDirectory no longer calls stat at all; every entry goes through lstatIfPresent, so no
path in the walk follows a link. A listed entry that is a symlink is refused by name. The
root itself is refused too unless the caller says otherwise: rootMayBeALink is a required
argument, answered yes by the corpus layout roots (where a symlink is the normal install)
and no by the workflow trees, the fixture tree, and any non-live corpus source. That
second half was not in the first implementation and is what two review rounds added.

lstatIfPresent lives in file-presence.ts beside statIfExists, narrowed to ENOENT, because
the first version read every failure as absence and silently dropped files a readable but
unsearchable directory contains.

What became possible but is not wired up: nothing. Every caller of hashDirectory now
states its own answer, and there is no new capability behind a flag.

Callers still on an older path: none for hashDirectory. But the refusal is translated to a
named CLI refusal at one call site only (session run). run, replay, and stale surface
SymlinkedEntryError raw, and the corpus screen turns it into a 500. That asymmetry is what
ACT-130 covers for the server surface.

Observed directly this session, not inferred: the leak reproduced and then refused at both
the entry position and the root position; a readable-unsearchable directory dropping a
file, then surfacing EACCES; the vanished-entry skip returning the surviving file; the
live corpus hashing 123 files at f835f75 and 123 at HEAD; the corpus screen rendering
'agents/escape.md is a symlink, ...'; the fixture refusal keeping RefusedPreconditionError.

Not verified: criterion #4 has no suite test, because forcing the readdir/lstat race needs
a seam in production code. It rests on the one direct observation above plus the
lstatIfPresent tests for absence and EACCES.

Filed and not fixed here: ACT-129 (three walks, three error types, one rule), ACT-130 (one
symlink blanks the run-history screen instead of degrading), ACT-131 (a flaky
concurrency-ordering test met in a full-suite run), ACT-132 (a symlinked CLAUDE.md at the
corpus root still bypasses the walk). ACT-128 was already in the tree from the shaping
session.

Two files in the working tree, cases/doctrine-ab-with/case.json and
cases/doctrine-ab-without/case.json, are another session's uncommitted work. Left as
found. They are why repo-wide fmt:check is red.
<!-- SECTION:FINAL_SUMMARY:END -->
