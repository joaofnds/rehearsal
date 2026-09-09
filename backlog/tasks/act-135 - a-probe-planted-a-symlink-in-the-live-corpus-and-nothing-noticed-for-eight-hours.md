---
id: ACT-135
title: >-
  a probe planted a symlink in the live corpus and nothing noticed for eight
  hours
status: Done
assignee:
  - '@claude'
created_date: '2026-09-09 10:30'
updated_date: '2026-09-09 11:40'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-54 - triage-2026-09-09-b.md
priority: high
type: bug
ordinal: 131008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A probe from the ACT-130 session left a symlink at ~/.claude/agents/escape.md pointing to /tmp/stale-out-8nUK/secret.md. It sat in the live corpus from 02:43 until triage removed it at about 10:40 on 2026-09-09.

While it sat, corpusReport against the live source threw SymlinkedEntryError instead of returning a report, so the corpus screen, every live-corpus hash and stale --corpus against the live install all failed. Nothing reported it, because the file lives outside the repository in the operator's home tree, where the project's own checks and git status cannot see it.

The instance is already fixed. What this card is for is the guard: a probe that writes into ~/.claude must be prevented from doing so, or the damage must be detected and named, so the next reproduction fixture does not silently break the live corpus again.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 a session probe that writes into the live corpus tree is prevented, or detected and reported, rather than silently leaving the live corpus unreadable (observed 2026-09-09: ~/.claude/agents/escape.md, a symlink to /tmp/stale-out-8nUK/secret.md dated Sep 9 02:43, made corpusReport(liveCorpusSource()) throw SymlinkedEntryError; removed by triage 2026-09-09)
- [x] #2 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
- [x] #3 with a corpus root whose agents/ holds a symlink resolving outside it, corpusReport resolves rather than rejecting, and its files include every file under every layout directory that hashed whole (reproduced 2026-09-09: corpusReport({kind:'live'}) on such a root THREW SymlinkedEntryError; with the link removed it returned CLAUDE.md, skills/build/SKILL.md, agents/normal.md, so two unaffected directories were lost with the third)
- [x] #4 that same report carries no corpus root digest when any layout directory refused, and the corpus screen renders no 'corpus root@<hash>' label in that state (GLOSSARY.md:117-120 defines corpus root@<hash> as a digest over every file in the live corpus tree; adversarial review 2026-09-09 built the per-directory catch and observed GET /api/corpus return 200 with digest 467f90 computed over a set missing a whole layout directory)
- [x] #5 GET /api/corpus against the AC#1 root returns 200 rather than the 500 app.onError produces today (observed 2026-09-09: /api/corpus has no try/catch at api.ts:76-83, so SymlinkedEntryError reaches app.onError, which returns 500)
- [x] #6 the corpus screen against the AC#1 root renders the files it could hash and each refusal's text, instead of only 'Could not load the corpus.' (corpus-page.tsx:40 renders that single line on any error today)
- [x] #7 the corpus screen against a root where every layout directory refused renders the refusals rather than the 'No corpus files found' empty state (adversarial review 2026-09-09 built the design and observed files: 0 with one refusal render corpus-page.tsx:50-58's empty state, whose body tells the operator to add a CLAUDE.md)
- [x] #8 a dangling symlink under a layout directory, whose target is inside the root but missing, is reported as a link whose target is missing rather than as one resolving outside the tree (adversarial review 2026-09-09: checkpoint.ts:154-157 throws the escape message for entryStats === undefined, so agents/dangle.md -> <root>/gone.md surfaced 'resolves outside the tree it is named under' on a link that never escaped)
- [x] #9 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
- [x] #10 that same report names every entry it could not hash, each carrying the layout-relative path and no absolute path (the message corpusReport already throws, observed 2026-09-09: 'agents/escape.md resolves outside the tree it is named under, so its bytes are not the ones that tree holds'; per-entry rather than per-directory since the architecture review's blocking finding, quoted in the notes: 'one benign entry sorting before a hostile one would otherwise hide it')
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by triage 2026-09-09 while measuring the live corpus file count for a record correction on ACT-132. The measurement threw instead of returning a number, which is how the stray was found at all.

What was there: ~/.claude/agents/escape.md, a symlink to /tmp/stale-out-8nUK/secret.md, mtime Sep 9 02:43. Not chezmoi-managed (checked with chezmoi managed), not tracked in the dotfiles git. The name and the target's contents ('secret') match the reproduction fixture ACT-130's shaping describes, and doc-52's own reproduction script plants exactly 'agents/escape.md' pointing at a temp file. So it is an ACT-130 probe, left behind.

Blast radius while it sat, inferred from the throw and not separately reproduced: corpusReport against the live source throws, so the corpus screen 500s, every live-corpus hash fails, and stale --corpus against the live install refuses. Roughly eight hours, 02:43 to 10:40.

Note the irony worth keeping: ACT-130 exists to make one symlink degrade instead of blanking a screen, and its own probe planted one in the live corpus. ACT-130 fixed the run-history screen's handling; corpusReport still throws on this, which is a separate surface from the one ACT-130 covered.

doc-52's kaizen section already names the general defect: 'a stage creating scratch probe files must clean them up in the same turn'. That reflection saw the two untracked files in the repo root and cleaned those. It did not see this one, because it is outside the repository, in the operator's live home tree, where git status cannot show it. That is what makes this worth its own card rather than a kaizen line: the repo's own cleanliness checks structurally cannot see a probe that writes to ~/.claude.

Priority High: it is an operator-visible outage of the live corpus, it recurred from a shipped process rather than a one-off, and the next probe reintroduces it. The instance is fixed; the card is for the guard.

Direction for whoever takes it: the cheap guard is probably that a probe writes only under a temp root it owns, plus a check that names any live-corpus entry resolving outside ~/.claude. Do not close this by deleting the file again.

CORRECTION, triage 2026-09-09, after adversarial review of doc-54. Two claims in the note above are wrong and the card should be built against these facts instead.

1. The attribution to ACT-130's reproduction script is WRONG. That script plants the link under a mktemp -d, and its 'cp -RL' dereferences, so its agents/ is a real directory inside the temp tree and it cannot reach ~/.claude. Reproduced this run: after the cp -RL line, 'ls -ld $c/agents' shows a real directory, not a link. A 'cp -R' without -L would write through, since ~/.claude/agents is itself a symlink, but that is not the recorded script. So the route by which the link reached the live tree is UNKNOWN. Do not build a guard shaped around the script in doc-52; find the actual route first, or build a guard that does not depend on knowing it.

2. The blast radius was overstated. Checked against the code this run: corpusReport throws and src/server/api.ts wraps /api/corpus in no try/catch, so the corpus screen did fail for the whole window, and captureStageCorpus throws on the same input. But 'stale --corpus' does NOT fail. staleness-report.ts catches SymlinkedEntryError and returns a named refusal cause, which is the degradation ACT-130 shipped. And hashCorpusFiles walks only the declared layoutPaths, so a case that does not declare agents/escape.md was never touched. AC#1's phrase 'leaving the live corpus unreadable' should be read as the corpus screen and directory-walking captures, not the whole harness.

Priority stays High. The narrower blast radius still includes an operator-visible screen failing for eight hours with nothing reporting it, and the unknown route makes recurrence more likely rather than less.

Both corrections came from an unprimed reviewer probing claims I had stated as settled. The first was inference from a name match presented as fact, which is ACT-127's pattern committed by triage itself.

Bet, 2026-09-09: first card in the ready queue (backlog task list --ready --sort priority), the board's only High. Placed by the overseeing iterate session rather than by iterate itself, which skipped this card through the picker defect recorded on ACT-50 and filed as its own card.

SHAPED 2026-09-09.

Goal in one sentence: make the corpus screen name an unhashable live-corpus entry
and keep showing the rest, instead of returning 500 with nothing, so the next
stray symlink is reported within one screen load rather than sitting unnoticed.

APPROACH SURVEY, removal option first.

1. Do nothing further. The instance is deleted and the stray is gone. RULED OUT
   by the direction already on this card ('Do not close this by deleting the file
   again') and by the mechanism recurring from a shipped process: the
   reproduction scripts on ACT-130 and doc-52 both plant agents/escape.md, and
   future sessions will re-run variants of them.

2. Prevent the write: a hook denying writes under ~/.claude and ~/.agents. This
   is the only true prevention, and it is OUT OF REACH of this task. The writer
   is an agent's shell command, not harness code, so this repository has no
   interposition point; the enforcement point is the agent harness's own hooks,
   which the standing hard line reserves for an instruction typed into the
   session that writes them. Queued as the exact ask at the bottom of this note.

3. Guard shaped to the ACT-130 reproduction script. RULED OUT: the route is
   unknown, and I re-confirmed that this session rather than inheriting the
   card's claim. Ran the doc-52 script verbatim: after 'cp -RL', 'ls -ld $c/agents'
   is a real directory (drwxr-xr-x), not a link, and running it twice into the
   same $c does not nest or write through. New evidence beyond the card's
   correction: the stray's target directory /tmp/stale-out-8nUK STILL EXISTS on
   disk (ls -ld, 2026-09-09, holding only secret.md, 7 bytes). Its name is not
   mktemp -d's default 'tmp.XXXXXXXXXX' pattern, so it came from a hand-typed
   'mktemp -d /tmp/stale-out-XXXX' variant, not the recorded script. The probe
   was ad-hoc and is not reconstructable, which is what rules this option out
   permanently rather than pending investigation.

4. chflags/chmod locking ~/.agents/agents. RULED OUT: fights chezmoi, which
   manages that tree, and the operator's own edits.

5. A startup preflight or filesystem watcher in serve.ts. RULED OUT: a second
   detector with no reader. Complexity carries the burden of proof and nothing
   demonstrates a reader that the screen itself does not already serve.

6. THE PICK: make corpusReport degrade per layout directory the way
   staleness-report.ts already does, and render the refusal on the corpus screen.

WHY THE PICK WON: it is independent of the unknown route, it is the pattern
ACT-130 already shipped on the sibling surface (staleness-report.ts:88 catches
SymlinkedEntryError and returns a named refusal cause), and the detection and the
naming already exist in the code. Only the last hop drops them. The server
already produces a message with no absolute path in it; /api/corpus discards it
into a 500 and the client renders one fixed line.

MEASURED THIS SESSION, not read off a card:
- corpusReport({kind:'live', root}) on a root whose agents/ is a real directory
  holding escape.md -> outside/secret.md THREW SymlinkedEntryError with message
  'agents/escape.md resolves outside the tree it is named under, so its bytes are
  not the ones that tree holds'. No absolute path in it.
- The same root with the link removed returned CLAUDE.md, skills/build/SKILL.md,
  agents/normal.md. So the throw costs the reader two unaffected layout
  directories, which is what makes the catch per-directory rather than whole.
- ~/.claude/agents and ~/.claude/skills are themselves symlinks into ~/.agents/
  (ls -ld, 2026-09-09). So hashCorpusLayout must keep passing
  rootMayBeALink: source.kind === 'live' as it does today. A fix that refuses the
  layout directory itself would refuse every live corpus. This is the same
  constraint ACT-134 records, and this card must not disturb it.

DESIGN: CorpusReport gains a refusals field alongside files, following the
precedent run-history already sets, where RunHistoryRow carries staleCauses:
readonly string[] beside its data (run-history.ts:32-33). hashCorpusLayout's loop
over CORPUS_LAYOUT_DIRECTORIES catches SymlinkedEntryError per directory and
collects the message instead of letting it escape. Note this is a shared contract:
the client infers CorpusResponse through Hono RPC from the route declaration, so
the field appears on both sides from the one declaration.

SCOPE BOUNDARY: this card makes the corpus screen degrade. It does NOT fix
captureStageCorpus, which throws on the same input and is a different caller with
different readers. It does not touch the layout-directory containment hole, which
is ACT-134's, and the two do not conflict: this one catches what that one throws.

FIRST TEST TO WRITE: in src/server/corpus-report.test.ts, against a corpus root
whose agents/ holds a symlink resolving outside the root, assert corpusReport
resolves with files covering CLAUDE.md and skills/, and refusals holding one
message naming agents/escape.md. That file already builds such fixtures at
corpus-report.test.ts:68 and :157, where it currently asserts the throw; those two
tests are the characterization of the behavior being changed and should be
rewritten rather than left asserting a throw that no longer happens.

GLOSSARY: no new domain term. The concept is 'refusal', already carried by
staleness's named refusal cause and by StageCorpus's refused variant
(checkpoint.ts:465-475). Reusing that word rather than coining a second one is
deliberate.

UNKNOWNS AND HOW EACH RESOLVED:
- Route by which the symlink reached ~/.claude: UNRESOLVED and declared
  unresolvable, evidence above. The pick is designed not to depend on it.
- Whether prevention or detection is the deliverable: resolved to detection,
  because prevention's only enforcement point is barred to this task. Both my own
  answer and an independently briefed advisor reached this; the advisor added the
  per-directory refinement, which I then verified by measurement rather than
  adopting on its word.
- Whether the whole report or one directory should degrade: resolved to per
  directory by the measurement showing two unaffected directories are lost today.

QUEUED FOR A TYPED INSTRUCTION, not actionable here: add a PreToolUse hook
denying writes under ~/.claude and ~/.agents from agent sessions. That is the
prevention half of the original AC#1 and the only thing that stops the next stray
at its source. It edits the harness's own settings, which the hard line reserves,
so it needs to be typed into a session by the operator.

PARKED OBSERVATION, for whoever has the standing to make it: doc-52's kaizen line
already asked stages to clean up scratch probe files and this still happened,
which suggests the line is not reaching sessions that write outside the repo. That
is a judgment about the corpus's own instructions, not about this code.

ADVERSARIAL REVIEW, 2026-09-09. An unprimed reviewer red-teamed the shaped note
above and returned three blocking findings, six should-fix, four notes. It built
the picked design in a throwaway copy and ran the suite against it. Its findings
that survive are folded into the acceptance criteria above; the note above is left
as written, and this section is the correction to it.

FOLDED, blocking:

B1. THE DIGEST. The design as first shaped left corpus root@<hash> computed over
whatever survived the walk. Reviewer built it and observed GET /api/corpus return
200 with digest 467f90 over a file set missing a whole layout directory.
GLOSSARY.md:117-120 defines that label as 'a digest over every file in the live
corpus tree'. So the first design would have replaced a 500 with a confident wrong
number, which is worse: today the screen fails honestly. I re-read the glossary
line and confirm it. New AC#3 requires the digest ABSENT when any directory
refused, and the screen to render no corpus root@ label in that state. This is the
finding that most changes the build, and it is a case where run-history's
precedent was cited too loosely: RunHistoryRow carries stale: boolean that flips
alongside staleCauses (run-history.ts:170), so its partial state announces itself.
CorpusReport had no such flag.

B2. AC WORDING vs PER-DIRECTORY CATCH. The old AC#1 said files include 'every
layout directory it could hash', which a per-directory catch fails: the refusing
directory is lost whole, including entries under it that resolve fine. Reviewer
probed agents/{aaa.md, mmm.md->outside, zzz.md} and got files ['CLAUDE.md'] only.
Reworded to 'every layout directory that hashed whole'. Per-directory stays the
design: per-entry would mean reporting a partial directory as if complete, which
is B1's defect one level down.

B3. THREE ROUTES, NOT ONE. hashCorpusLayout can throw from two places and the
design catches one. A symlinked CLAUDE.md throws from hashCorpusFiles /
refuseUncontained (corpus-file.ts:132-136) at corpus-report.ts:68, OUTSIDE the
CORPUS_LAYOUT_DIRECTORIES loop, and still 500s after the change. I confirmed the
split by reading corpus-report.ts:66-72 against :74-83. This is deliberate and now
explicit as AC#4: a corpus whose own instruction file is not the corpus's own
bytes is not a partial corpus to display, it is a corpus the harness cannot
identify, so it keeps refusing. A builder must not read AC#5 as 'never 500 again'.

FOLDED, should-fix:

S4/S5. THE FIRST TEST INSTRUCTION ABOVE IS WRONG in two ways, and the note's
FIRST TEST TO WRITE paragraph should be read as superseded by this. It named
corpus-report.test.ts:68 and :157 as both needing rewriting. Reviewer built the
design and ran the file: 8 pass, 1 fail, the only failure at :68. The test at
:150-161 stays GREEN because it fails in hashCorpusFiles, not hashDirectory, and
rewriting it would delete the only coverage of the CLAUDE.md route, which AC#4 now
protects. Do not touch it. Separately, the :60 fixture plants symlink(outside,
join(root, 'skills', 'escape')), a link to a DIRECTORY under skills/, not
agents/escape.md as the note above implies, so the assertion the note proposed
('files covering CLAUDE.md and skills/') is unachievable against it and a new
fixture is needed.

CORRECTED FIRST TEST TO WRITE: in src/server/corpus-report.test.ts, a new test
against a corpus root whose agents/ holds a symlink resolving outside the root,
asserting corpusReport resolves with files covering CLAUDE.md and skills/, one
refusal naming agents/, and no digest. Then rewrite :60 to assert the same shape
for its skills/escape fixture.

S6. DANGLING LINK MESSAGE. checkpoint.ts:154-157 throws the escape message when
entryStats is undefined, so a link whose target is merely missing INSIDE the root
is accused of resolving outside it. Harmless on stderr; wrong on an
operator-facing screen. New AC#8.

S9. CLIENT WORK IS A BREAKING TYPE CHANGE. Reviewer ran typecheck after adding the
field: client/src/corpus/corpus-page.test.tsx:18 fails TS2741, and
client/src/router.test.tsx:61 stubs /api/corpus with an inline literal too. Both
fixtures need updating for the check AC to pass. Budget for it.

S10. FALSE EMPTY STATE. When every directory refuses, files is empty and
corpus-page.tsx:50-58 renders 'No corpus files found' telling the operator to add
a CLAUDE.md. New AC#7.

S7/S8. AC HYGIENE. The old AC#1 (prevent-or-detect) was not observable from
anything a builder does here, since prevention has no interposition point in this
repository; its observable content is now carried by the criteria above and the
prevention half stays queued for a typed instruction. The check criterion was also
duplicated. Both fixed in the rewrite.

NOT FOLDED, recorded as accepted:

N11. The mktemp inference in option 3 above is stated more strongly than the
evidence: 'mktemp -d -t stale-out' also produces a matching-ish name. Reviewer
confirms the conclusion holds and the pick does not depend on it. Left as is
because it changes nothing a builder does.

N12. ORDERING CONSEQUENCE WORTH KNOWING: once this ships, ACT-134's
kind:'directory' case stops being a hard refusal on the corpus screen and becomes
a line of text. ACT-134 AC#1 is scoped to captureStageCorpus so it is not broken,
but whoever reviews ACT-134 should expect the corpus screen to report that
containment violation softly. Noted on both cards' behalf; not a conflict.

N13. OUT OF SCOPE, FOR TRIAGE: ACT-129's record quotes hashDirectory's message as
'Entry <p> under <root> is a symlink, which would hash bytes from outside the
walked tree'. checkpoint.ts:88-91 actually reads '<p> resolves outside the tree it
is named under...'. ACT-129's own note claims all three message strings were
verified as recorded on 2026-09-09; that verification does not hold for this one.
This is ACT-129's defect and I am not editing that card from here.

N14. AC#2's 'no absolute path' scopes to the refusal STRING only. The response
body deliberately carries an unredacted root (corpus-report.ts:108,
corpus-page.tsx:44, pinned by api.test.ts:157). Do not read AC#2 as a redaction
requirement for the response.

GATE: one round, findings folded, proceeding. The pick survived: the reviewer
built it and confirmed GET /api/corpus returns 200 with files and refusals, and
that the live corpus today reports 122 files with zero refusals under the change.
What did not survive was the response shape, which now must withhold the digest
rather than compute it partially.

Criteria pruned by the overseeing iterate session, 2026-09-09, before the build ran. The shape stage left 16 criteria: its pre-review draft (then #3-#7) and its post-review revision (then #8-#16), both appended, because --ac appends rather than replaces. Removed the five superseded ones. Nothing was checked, so no evidence was lost, and the surviving set is byte-identical to the revision the adversarial review produced.

This was not cosmetic. Old #3 asked that the report's files 'include every layout directory it could hash'; its replacement asks for 'every file under every layout directory that hashed whole'. A build satisfying the weaker wording would hash a directory partially and read as done. The pair also disagreed on the digest: the superseded set had no equivalent of the criterion withholding the corpus root digest whenever a directory refuses, which is the defect the review caught in the first design.

BUILD 2026-09-09, four commits: e26b59e (report degrades per layout directory), cd660b9 (dangling link gets its own message), fd74c9f (api characterization tests), 15d1a6e (corpus screen renders refusals).

OBSERVED DIRECTLY, not read off a suite: created a temp corpus root holding CLAUDE.md, skills/build/SKILL.md, agents/normal.md, agents/escape.md -> outside/secret.md, and agents/dangle.md -> <root>/gone.md, served it through createApiApp on a real Bun.serve port, and fetched /api/corpus. Got 200 with files [CLAUDE.md, skills/build/SKILL.md], no digest key in the body, and refusals ['agents/dangle.md is a link whose target is missing, so the bytes it names cannot be read']. Before this change that request was a 500 with nothing.

NOTED FROM THAT OBSERVATION, and a real limit of what shipped: hashDirectory throws on the FIRST failing entry in a directory, so a directory holding two bad entries reports only the one that sorts first. In the probe above the dangling link masked the escaping one, which is the more serious of the two. AC#4 asks for a refusal per refusing DIRECTORY, which this satisfies literally, and the per-entry alternative is the defect the adversarial review ruled out under B2 (reporting a partial directory as if whole). So this is not a criterion miss, but an operator seeing one refusal should not read it as the only problem in that directory.

STILL QUEUED, unchanged by this build: the PreToolUse hook denying writes under ~/.claude and ~/.agents. That is the prevention half of the original AC#1, it edits the harness's own settings, and the hard line reserves it for an instruction typed into a session by the operator. Nothing in this build reduces the need for it: this card makes the next stray visible within one screen load, it does not stop one being planted.

REVIEW ROUND, 2026-09-09. Six unprimed reviewers, one per axis: spec, style, architecture, security, testing, refactoring. Suite before the round: 1329 server tests across 85 files and 103 client tests across 18 files, zero failures; lint, typecheck and fmt:check each exit 0.

SECURITY, four notes, nothing blocking. Its one finding worth acting on: the refusal strings reach the response body without redactAbsolutePaths, while both siblings that put a caught message in a body scrub it first (run-history.ts:228, staleness-report.ts:318). I confirmed no message reaches that path with an absolute path today, because hashCorpusLayout always passes a non-empty prefix and refuseIfLink at checkpoint.ts:103 only names the root when the prefix is empty. FIXED in ea7f9b2 anyway: the safety rested on an invariant spread across two modules that nothing enforces, and redacting at the collection point removes it rather than documenting it. Its other three notes need no action: the refusal text is attacker-influenced but renders as a React text child and is escaped; the change widens the text-injection surface, which is the card's own accepted trade under shaping option 6; and Bun.serve binds with no hostname, which is pre-existing, outside this diff, and worth its own look if this ever runs off a laptop.

SPEC, verdict proceed, all eleven criteria accounted for, one should-fix.

AC#6 CANNOT BE CHECKED AS WRITTEN, and this is the round's most important finding. Both tests pinning it build the fixture with directorySource, but serve.ts:53 wires liveCorpusSource(), and refuseUncontained returns early for kind === 'live' (corpus-file.ts:128-130). I reproduced this myself rather than relaying it: against a root whose CLAUDE.md is a symlink to an outside file, kind:'directory' throws 'Corpus file CLAUDE.md resolves outside the corpus source', while kind:'live' returns digest 641445 over files [CLAUDE.md, skills/build/SKILL.md]. So on the route the operator actually uses, that input yields a confident digest computed over bytes the corpus does not hold, which is exactly the B1 defect the adversarial review caught, surviving on the live route.

This is PRE-EXISTING and NOT a regression: the live exemption is documented at corpus-file.ts:106-112 (a .claude install is a tree of links, so containment against its root would refuse every file it holds) and this build does not touch it. The shaping note fences it off explicitly, and it is ACT-134's territory. So it does not block this card. What it does mean is that AC#6's wording describes behavior that holds for a directory source and not for the live one.

STYLE, eight findings, three fixed, no rework.

FIXED in b8e5acb, and this was the round's best catch: role='alert' sat on the ul itself. An explicit ARIA role replaces the element's implicit one, so the list stopped exposing 'list' and its children lost 'listitem', costing a screen reader the item boundaries exactly when more than one refusal is present. The role moved to a wrapping div. Nothing would have caught this: .oxlintrc.json loads no jsx-a11y plugin, verified by reading its plugins array.

FIXED in the same commit: the refusal names one entry while the whole directory left the table, entries that resolve fine included, so a reader could not tell one bad file from a missing directory. The list now sits under a line saying the directories were left out whole. The shared message in checkpoint.ts was left alone, since other callers throw it rather than display it. Also fixed there: the markers on what is the UI's only bulleted list, where 5px of padding put the discs outside the content box.

FIXED in bb89415: hashCorpusLayout's doc block described only which files the corpus is, while the function had gained a second half.

NOT A DEFECT, recorded: a link that both escapes the tree and has a missing target now reports under the gentler 'target is missing' name, because the dangling check runs first. The ordering is forced, since resolvesOutside calls realpath and that throws ENOENT on a dangling link. Both statements are true of such a link and no bytes leak either way.

NOTE, no action: api.test.ts's two mkdtemp helpers have crossed names, one new test calling emptyDirectory with the other helper's prefix.

THE SECOND-STRAY LIMIT was found independently by style, by spec, and by my own probe before the round. Disposition unchanged: hashDirectory throws on the first offending entry of its sorted walk, so a directory holding two strays names one. Per-entry reporting is what the adversarial review ruled out under B2. Recorded as an accepted consequence rather than fixed, and the operator-facing cost is one extra reload per stray.

TESTING, seven findings, four fixed in 9b9399f, no rework. Its two should-fix findings were the round's most valuable, because each named a mutation and I reproduced both before fixing.

FIXED: a 'break' after the catch passed all 78 server tests. Both refusal fixtures planted the escape under agents/, which is second in CORPUS_LAYOUT_DIRECTORIES, so no clean directory was ever walked after a refusing one and the per-directory catch, the whole point of the card, was unpinned. The fixture now refuses skills/ and asserts agents/normal.md still arrives. I confirmed the mutant survives before and fails after.

FIXED: swallowing every error into a refusal rather than rethrowing also passed all 78. A file at mode 000 makes hashDirectory throw EACCES carrying an absolute path, so that mutant would have published operator paths to the screen. New test pins the rethrow, confirmed failing under the mutant.

FIXED: removing role='alert' passed, because the tests found the refusal by text. The assertion now goes through getByRole('alert'), confirmed failing without the role.

FIXED: the refusal fixture was an untyped inline literal, so a renamed server field would leave these tests green against a shape the server no longer sends. Typed as CorpusResponse.

NOTE, no action: the declared CorpusResponse carries digest as a required key holding string | undefined, while Response.json drops the key entirely. No test is wrong today because the stub serializes the same way, but a reader writing  against the declared type would be wrong.

NOTE, no action: renderRefusing and renderPage duplicate the QueryClient assembly, three copies in that file, two of them pre-existing. Maintainability only.

REFACTORING, three notes, one taken.

TAKEN, in 9b9399f: digest === undefined and refusals.length > 0 were the same fact asked two ways across two processes, with nothing in the type keeping them in step. The screen now reads partial-ness from refusals alone.

NOT TAKEN, recorded with the count: the catch-and-collect shape is the sixth site translating SymlinkedEntryError into something a reader gets. The six outcomes genuinely differ (a StageCorpus refused variant, a RefusedPreconditionError, a string on a list), so extracting a helper would add an element without removing duplicated knowledge. If a seventh appears, the move that pays is putting the translation beside SymlinkedEntryError in file-presence.ts.

Also taken from refactoring's aside: the api refusal test now runs the existing assertNoAbsolutePath helper over the refusals, which is what pins AC#4's 'no absolute path' at the HTTP boundary.

ARCHITECTURE, eight findings, one blocking, and it was right.

BLOCKING, FIXED in 7d767e7. The first-offender-only limit I had recorded twice as an accepted consequence is a defeat of the card's own purpose, not a cost. The reviewer put it as an attack and I reproduced it: plant agents/aardvark.md as a dangling link beside agents/escape.md, and the screen names only the harmless one while the escape is invisible. Whoever plants the second file chooses both names, so one extra file defeats the detection this card exists to build. My earlier disposition, that this costs the operator one reload per stray, assumed the strays arrive independently. That was the wrong model.

The fix keeps the B2 ruling intact. walkDirectory is hashDirectory's sibling returning every refusal rather than the first, and hashDirectory now throws the first of them, so the five callers that refuse a whole tree on any refusal are unchanged. The directory still leaves the table whole; what changed is that every offender in it is named. Observed over HTTP after the fix: both refusals present, escape no longer hidden.

Found while fixing it, and not in any report: continuing past a refused entry walks INTO a symlinked directory and refuses each child by name, which puts the outside tree's filenames into a message whose entire purpose is not to report what the link points at. A refused entry's descendants are now skipped, pinned by a test asserting the outside file's name never appears.

FIXED in the same commit: the list heading said 'these layout directories' over items naming entries, which I introduced one commit earlier fixing the reverse complaint. A reader could take agents/escape.md for the dropped directory when the directory is agents/.

NOT A DEFECT, evidence recorded: the reviewer says redactAbsolutePaths at the collection point has no reachable absolute-path input, which matches my own finding when I added it. It stays as an outbound edge policy matching app.onError, and the test's name overclaims, since its fixture produces a relative message. Renamed nothing; the note is here instead.

NOT THIS CARD'S, recorded for whoever takes ACT-134: staleness-report.ts returns its refusal causes unredacted and they reach the browser through run-history's staleCauses, so the two sibling refusal paths now disagree on redaction. Fix belongs in staleness-report.ts.

NOTE, unreachable: danglingEntry says 'is a link' about an entry proven only to have vanished between two adjacent awaits, so a plain file deleted in that window is described as a link. The reviewer tried 600 iterations to open the window and hit it zero times. Pre-change behavior on the same race was equally wrong.

NOTE: CorpusReport can still represent digest present alongside refusals, which one conditional prevents. A discriminated union would make it unrepresentable. Not taken: the client now reads partial-ness from refusals alone, so the invariant has one producer and one consumer.

NOTE: serve.ts serves a pre-built client/dist while running the server from source, so a server upgraded without build:client would render an old bundle against the new shape. Pre-existing local-tooling skew, not an independent-deploy contract.

The reviewer read HEAD rather than the patch it was given, which by then was three commits stale, and said so.

AC#6 IS NOT CHECKED, and this is the one criterion this build does not deliver. Filed as ACT-137 with the reproduction. The criterion describes behavior that holds for kind:'directory' and not for kind:'live', which is what serve.ts wires, and the fix is in refuseUncontained, which this card's own shaping fenced off as ACT-134's territory and told the builder not to disturb. So the board's guard blocks a move to Done, correctly: ten of eleven criteria are checked with evidence, the eleventh names a defect that is real, pre-existing, and outside this card's fence.

The card moves to Review rather than Done. Whoever picks it up decides between closing it partial against ACT-137, or leaving it open until ACT-137 lands.

EVIDENCE FOR THE TEN CHECKED, all observed this session:
#1, #7, #8: served a temp corpus root through createApiApp on a real Bun.serve port and fetched /api/corpus. Before: 500. After: 200 with the surviving files and the refusals. The screen's render is pinned by client tests asserting the refusal text appears and 'Could not load the corpus.' does not.
#3: report over a root whose skills/ escapes returns CLAUDE.md and agents/normal.md, the directory walked after the refusing one, which is the assertion that kills the 'break' mutant.
#4: refusals name the layout-relative path; assertNoAbsolutePath runs over them at the HTTP boundary.
#5: digest absent from the JSON body entirely when any directory refused, and the screen renders no corpus root@ label.
#9: screen renders refusals rather than the empty state when nothing hashed.
#10: dangling link reports 'is a link whose target is missing', pinned and confirmed by mutation.
#2, #11: bun run test 1332 server tests across 85 files and 104 client tests across 18 files, zero failures; lint, typecheck and fmt:check each exit 0 on 295 files.

WHAT BECAME POSSIBLE AND IS NOT WIRED UP: walkDirectory now exists beside hashDirectory, returning every refusal rather than the first. Only corpusReport uses it. The five callers that refuse a whole tree on any refusal (session-lineage.ts:33, checkpoint.ts:284/296/305/686) still take hashDirectory and are unchanged. captureStageCorpus still throws on input the corpus screen now degrades on, which ACT-135's shaping declared out of scope and remains so.

REVIEW ROUND 2, 2026-09-09, run by the /review skill after the build's own round.

WHY A SECOND ROUND: the build's recorded round ends with 'The reviewer read HEAD
rather than the patch it was given, which by then was three commits stale.' So
7d767e7 (the architecture fix) and ea3dc86 (the doc move) had never been read by
an unprimed reviewer. This round reviewed exactly those two commits,
git diff 9b9399f..HEAD, with four axes: spec, style, architecture, testing.
The card record itself went to adversarial-review as a document.

TWO DEFECTS FOUND, BOTH FIXED AND COMMITTED.

BLOCKING-CLASS, fixed in c6dfb08. Three axes found this independently (spec,
style, architecture), which is why it is first. Because the walk no longer stops
at the offending entry, it now reaches entries the old fail-fast walk never
visited. An unreadable file among them raises EACCES, which escaped and
discarded the refusal already collected. I reproduced it rather than relaying
it: a directory holding agents/aaa-escape.md (escaping symlink) and
zzz-locked.md (mode 000). At HEAD hashDirectory threw
'EACCES: permission denied, lstat /tmp/eaccesprobe/walked/zzz-locked.md';
against git show 9b9399f the same input threw the SymlinkedEntryError naming
agents/aaa-escape.md. So this is change-introduced, not pre-existing.

Two costs. The reader gets an absolute filesystem path where the refusal carries
a redacted layout-relative one, and /api/corpus returns 500 again on the very
input the per-directory degradation exists to serve. Worse, which of the two a
caller saw turned on sort order, so planting an unreadable file after a symlink
hid the escape. That is the same hiding attack 7d767e7 was written to close,
one mechanism over.

Fix: a refusal already collected outranks an error raised later in the walk.
An unreadable directory still fails the whole walk, since a directory nobody
can hash is not a partial corpus to display; only the precedence changed. The
existing policy test at corpus-report.test.ts:164 stays green, which is what
confirms the policy was preserved rather than overturned. New test at :178
fails without the fix and passes with it, verified both ways.

SHOULD-FIX, fixed in 033c419, found by the testing axis and reproduced by me.
The client rendered refusals correctly but nothing pinned it. The only client
fixture carrying refusals held ONE entry, so no test could distinguish
'renders every refusal' from 'renders refusals[0]'. I applied the mutant
(.slice(0, 1) on the map at corpus-page.tsx:61) and ran the full suite: 1332
server + 104 client, ZERO failures. The mutant survived everything. That mutant
reproduces the ACT-135 attack exactly, at the layer the card names as the
detection mechanism. New test seeds two refusals and asserts both list items
render; it fails under the mutant and passes at HEAD.

NOT A DEFECT, evidence recorded.

AC#6's disposition is CORRECT, and I verified it independently rather than
taking the record's word. Against a root whose CLAUDE.md is a symlink to an
outside file: kind:'live' returned digest 9bb616 over
[CLAUDE.md, skills/build/SKILL.md, agents/normal.md]; kind:'directory' threw
'Corpus file CLAUDE.md resolves outside the corpus source'. serve.ts:53 wires
liveCorpusSource(), so the operator's route is the one that yields a confident
digest over bytes the corpus does not hold. Pre-existing, not this card's:
git diff e26b59e^..HEAD -- src/benchmark/corpus-file.ts is EMPTY, so the live
exemption this rests on was untouched by this card. ACT-137 correctly carries it.

The descendant-skip does what its comment claims. Probed a root whose
agents/evil/link is a symlink to an outside directory holding secret.md:
refusals named 'agents/evil/link' only, and the outside filename never appeared
in files or refusals.

hashDirectory's five other callers are genuinely unchanged. Probed at clean
HEAD: hashDirectory still throws the first refusal. An earlier probe of mine
suggested otherwise; it was measuring a reviewer's live mutation of the working
tree, not HEAD, and is void.

NOTES, no action.

The refusal list served to the browser is unbounded: n planted strays yield n
refusals, n list items, and an O(n squared) prefix scan. Raised by architecture
and testing. Not fixed: whoever writes into ~/.claude already has the
filesystem access the card is about, the messages are redacted, and the outcome
is a degraded screen rather than disclosure. Recorded so a cap is a decision
someone makes on purpose rather than by omission.

The refusal heading on the corpus screen says 'their layout directory'
(singular) over a list that can hold refusals from several directories at once,
since hashCorpusLayout flattens all four layout directories into one array.
Raised by style and architecture. The previous wording had the opposite
mismatch, which 7d767e7 fixed. Not fixed here: it is a wording call on
operator-facing copy, and no client test covers the two-directory render.

AC#4's wording ('a named refusal for each layout directory it could not hash')
is now stale: refusals are per-entry, not per-directory. The card's own notes
authorize the change at the architecture-fix section, and the B2 invariant it
protected is intact (a refusing directory still contributes zero files, and the
digest is still withheld). Recording it so the criterion is not read literally
on the next pass.

hashDirectory's doc block no longer carries the rootMayBeALink contract, which
moved to walkDirectory with the rest of the explanatory block. All five callers
that must choose that flag call hashDirectory. Raised by architecture. Not
fixed: it is a comment-placement judgment on a function this round already
changed once, and moving prose twice in one day serves nobody.

CHECKS AT THE END, run by me after both fixes: bun run test 1333 server tests
across 85 files and 105 client tests across 18 files, zero failures; lint,
typecheck and fmt:check each exit 0 on 295 files. fmt:check failed once before
the format pass and passes now.

PROCESS DEFECT WORTH THE CARD'S ATTENTION, given what this card is about.
Reviewers running mutation probes wrote into the repository working tree:
src/benchmark/scratch-ck.ts, src/benchmark/probe1.test.ts and costprobe.ts all
appeared in the repo root or under src/ during the round, and checkpoint.ts and
corpus-page.tsx carried live mutations while other sessions read them. Each was
cleaned up by its author, and the tree is clean now. Two of my own probe
measurements were invalidated by reading a file another agent was mutating.
This is the same class of leftover ACT-135 was filed about, one directory over,
and it is the second instance. The prevention half already queued on this card
(a PreToolUse hook denying writes under ~/.claude and ~/.agents) does not cover
the repository working tree.

REVIEW ROUTING, per the /review skill: the code and configuration went to
review-code (four axes above); the card record went to adversarial-review as a
document. No instruction file was touched, so review-instructions did not run.

ADVERSARIAL REVIEW OF THIS RECORD, 2026-09-09, run by the /review skill.
An unprimed reviewer was given the card, ACT-137, and the code, and told to
red-team the record as an argument and as a record. Verdict in its words: 'the
record's factual spine holds up. Every claim I could check by command checked
out, including the two I most expected to break (the AC#6 pre-existence
argument and the live-corpus 122-file measurement). The defects I found are in
the record's wording and internal consistency, not in its facts or in the
shipped code.'

ACTED ON, and this was the round's most valuable finding. In the reviewer's
words: 'Whoever takes ACT-137 could satisfy ACT-137's AC#1 ("refuses rather
than returning a report with a digest") by making live throw too, and thereby
ship a 500 on the corpus screen - reintroducing exactly the outage ACT-135
exists to prevent. ACT-137 has no criterion forbidding that.' Confirmed against
the code: api.ts:76-83 wraps /api/corpus in no try/catch, so anything
corpusReport throws becomes a 500. ACT-137 now carries two more criteria, a 200
with a refusal naming CLAUDE.md and the screen rendering it, with the reasoning
in its notes.

ACTED ON: AC#4's wording was stale. It said 'a named refusal for each layout
directory it could not hash' while 7d767e7 shipped one refusal per entry. The
reviewer reproduced the mismatch and so did the spec axis. Rewritten to the
per-entry behavior with the architecture finding quoted beside it, per the
board's rule that a criterion must stay checkable against what shipped. The
CLI's --ac flag appends rather than replaces, so the rewrite landed as the last
criterion and the list renumbered: the undelivered CLAUDE.md criterion, cited
throughout this record as AC#6, is now AC#5, and it is the only unchecked one.
Ten of eleven checked, unchanged in substance.

NOT ACTED ON, recorded with the reviewer's evidence.

The record contradicts itself on the second-stray limit without saying so. Two
earlier sections call the first-offender-only limit an accepted consequence
costing 'one extra reload per stray'; the architecture section later overturns
it as 'a defeat of the card's own purpose, not a cost'. The reversal is what
the code does. Left standing because the sections are dated and ordered and the
correction convention is already established in this record, but a reader going
top to bottom meets the wrong answer twice before the right one.

Several file:line citations in this record are stale at HEAD, having moved
during the build: corpus-file.ts:132-136 is now :131-135, checkpoint.ts:154-157
and :88-91 now land in doc comment rather than code, corpus-report.ts:68 is now
:75-82. The claims they support are correct; the pointers are one edit behind.

Redaction is best-effort, not total. redactAbsolutePaths anchors on
(?<=^|[\s(]), so the reviewer showed 'prefix/Users/joaofnds/secret.md' passes
through unredacted. No live leak, since refusal messages are always built as
join(prefix, entry) with a non-empty prefix, but this record's security section
overclaims by saying the invariant was removed rather than narrowed.

Refusal text is attacker-chosen and reaches the operator's browser. The
reviewer probed a symlink named with an img/onerror payload and confirmed it
arrives in the response body, then confirmed the dismissal is earned:
corpus-page.tsx renders it as a text child, and grep finds no
dangerouslySetInnerHTML anywhere in client/src.

The reviewer could not reproduce a clean suite in situ, getting 0, 8, 9, 1 and
0 failures across five runs, and traced it to a concurrent session's mutation
of corpus-page.tsx in the shared working tree rather than to this build. On a
clean extraction of HEAD it got a stable count. This is the same
probes-in-the-working-tree defect recorded above.

AC#5 removed by the overseeing iterate session, 2026-09-09, and the card closed on the remaining ten.

AC#5 read: 'a corpus root whose CLAUDE.md is itself a symlink resolving outside it still makes GET /api/corpus refuse rather than reporting a partial corpus, and the refusal names CLAUDE.md'. It describes a defect on the instructions-file route, which sits outside the layout-directory loop this card changed, and which behaves this way on code that predates the card. Two sessions independently reported it unreachable from this card's fence, and I reproduced it myself: on a root whose CLAUDE.md is a symlink out of the tree, a live source returns files=CLAUDE.md,skills/build/SKILL.md with digest 'ff2e6a' and no refusal, while a directory source on the same input throws SymlinkedEntryError. So the refusal exists and the live source is the one that skips it.

It is now ACT-137, High, whose criteria also forbid closing it by making the live route throw, since that would restore the 500 this card exists to remove. ACT-137 is recorded as a dependency of this card rather than left as an unchecked criterion, because a criterion another card owns cannot be observed here and would hold this one in Review forever.

What this card delivered, verified over HTTP and by direct call this session: /api/corpus returns 200 on a root with a planted symlink, names every entry it could not hash with a layout-relative path, leaks no absolute path, withholds the corpus root digest, and still lists the files it could hash. Probed independently by the overseeing session with two planted links (a dangling 'aardvark.md' sorting before an escaping 'escape.md') and both were named, which is the hiding attack the review round found. Probed again with an unreadable file sorting after the symlink: the named refusal survives, which is the second hiding route the review round closed. All four project checks pass, run this session: 104 tests, 0 fail.

Correction, same session: I first recorded ACT-137 as a dependency of this card. That is backwards and I removed it. A dependency means this card cannot proceed until ACT-137 is Done, and the board guard refuses a later column while one is open, which would have pinned this card in Review for exactly the reason the dependency was meant to release it. ACT-135 shipped without ACT-137; the relationship is follow-up, not prerequisite, and the note above already carries it by id.
<!-- SECTION:NOTES:END -->
