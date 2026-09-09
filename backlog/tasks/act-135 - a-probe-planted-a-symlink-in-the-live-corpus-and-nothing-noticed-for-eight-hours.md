---
id: ACT-135
title: >-
  a probe planted a symlink in the live corpus and nothing noticed for eight
  hours
status: Build
assignee:
  - '@claude'
created_date: '2026-09-09 10:30'
updated_date: '2026-09-09 10:57'
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
- [ ] #1 a session probe that writes into the live corpus tree is prevented, or detected and reported, rather than silently leaving the live corpus unreadable (observed 2026-09-09: ~/.claude/agents/escape.md, a symlink to /tmp/stale-out-8nUK/secret.md dated Sep 9 02:43, made corpusReport(liveCorpusSource()) throw SymlinkedEntryError; removed by triage 2026-09-09)
- [ ] #2 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
- [ ] #3 with a corpus root whose agents/ holds a symlink resolving outside it, corpusReport resolves rather than rejecting, and its files include every file under every layout directory that hashed whole (reproduced 2026-09-09: corpusReport({kind:'live'}) on such a root THREW SymlinkedEntryError; with the link removed it returned CLAUDE.md, skills/build/SKILL.md, agents/normal.md, so two unaffected directories were lost with the third)
- [ ] #4 that same report carries a named refusal for each layout directory it could not hash, naming the layout-relative path and no absolute path (the message corpusReport already throws, observed 2026-09-09: 'agents/escape.md resolves outside the tree it is named under, so its bytes are not the ones that tree holds')
- [ ] #5 that same report carries no corpus root digest when any layout directory refused, and the corpus screen renders no 'corpus root@<hash>' label in that state (GLOSSARY.md:117-120 defines corpus root@<hash> as a digest over every file in the live corpus tree; adversarial review 2026-09-09 built the per-directory catch and observed GET /api/corpus return 200 with digest 467f90 computed over a set missing a whole layout directory)
- [ ] #6 a corpus root whose CLAUDE.md is itself a symlink resolving outside it still makes GET /api/corpus refuse rather than reporting a partial corpus, and the refusal names CLAUDE.md (adversarial review 2026-09-09: this route throws from hashCorpusFiles/refuseUncontained at corpus-file.ts:132-136, reached at corpus-report.ts:68, outside the layout-directory loop; src/server/corpus-report.test.ts:150 pins it and stays green under the per-directory catch)
- [ ] #7 GET /api/corpus against the AC#1 root returns 200 rather than the 500 app.onError produces today (observed 2026-09-09: /api/corpus has no try/catch at api.ts:76-83, so SymlinkedEntryError reaches app.onError, which returns 500)
- [ ] #8 the corpus screen against the AC#1 root renders the files it could hash and each refusal's text, instead of only 'Could not load the corpus.' (corpus-page.tsx:40 renders that single line on any error today)
- [ ] #9 the corpus screen against a root where every layout directory refused renders the refusals rather than the 'No corpus files found' empty state (adversarial review 2026-09-09 built the design and observed files: 0 with one refusal render corpus-page.tsx:50-58's empty state, whose body tells the operator to add a CLAUDE.md)
- [ ] #10 a dangling symlink under a layout directory, whose target is inside the root but missing, is reported as a link whose target is missing rather than as one resolving outside the tree (adversarial review 2026-09-09: checkpoint.ts:154-157 throws the escape message for entryStats === undefined, so agents/dangle.md -> <root>/gone.md surfaced 'resolves outside the tree it is named under' on a link that never escaped)
- [ ] #11 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
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
<!-- SECTION:NOTES:END -->
