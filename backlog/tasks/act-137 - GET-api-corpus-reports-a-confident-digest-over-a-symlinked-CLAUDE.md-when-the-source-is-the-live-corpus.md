---
id: ACT-137
title: report unhashable root instructions as named corpus refusals
status: Done
assignee:
  - '@claude'
created_date: '2026-09-09 11:16'
updated_date: '2026-09-09 16:23'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-56 - triage-2026-09-09-c.md
  - backlog/docs/doc-58 - Shaping-ACT-137-live-corpus-containment.md
  - backlog/docs/doc-60 - reflection-ACT-137.md
priority: high
type: bug
ordinal: 133008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A corpus root whose CLAUDE.md is itself a symlink resolving outside the root is hashed and reported, rather than refused, when the source is the live corpus. The report carries a corpus root digest computed over bytes the corpus does not hold, and carries no refusal naming the file.

Reproduced by the overseeing iterate session, 2026-09-09, on a root holding only skills/build/SKILL.md and a CLAUDE.md symlinked to a file outside the root:
  live source:      RESOLVED files=CLAUDE.md,skills/build/SKILL.md digest='ff2e6a' refusals=[]
  directory source: THREW SymlinkedEntryError

So the refusal exists and works, and the source the server actually wires is the one that skips it. This is the same defect class ACT-135's shape review rejected in that card's first design: a confident digest over a partial or foreign file set is worse than an honest failure, because nothing downstream can tell it is wrong. ACT-135 shipped the refusal for layout directories; this route is the hole left in it.

Why the live source is lenient, and why the fix is not just 'refuse here too': ~/.claude's own layout directories are symlinks into ~/.agents, so the live walk must tolerate a linked root. AC#2 exists to keep that working.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 the live corpus still reports its files, since ~/.claude's own layout directories are symlinks into ~/.agents and refusing them would empty every report (measured on ACT-135: corpusReport(liveCorpusSource()) returns 122 files with zero refusals)
- [x] #2 against that same root, GET /api/corpus returns 200 carrying a refusal that names CLAUDE.md, not a 500 (adversarial review of ACT-135's record, 2026-09-09: api.ts:76-83 wraps the route in no try/catch, so satisfying AC#1 by throwing would return the 500 that ACT-135 AC#7 exists to eliminate)
- [x] #3 the corpus screen against that root renders the refusal naming CLAUDE.md rather than 'Could not load the corpus.' (same review: ACT-135 AC#8 pins that text for the layout-directory case, and this route must not regress it)
- [x] #4 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
- [x] #5 corpusReport on a directory source whose CLAUDE.md is a symlink to a file outside the root returns a report whose refusals names CLAUDE.md and whose digest is undefined, rather than throwing (reproduced 2026-09-09, tmp-probe/probe5.ts: THREW SymlinkedEntryError before any report was returned)
- [x] #6 GET /api/corpus with that source injected through ApiDependencies returns 200 and a body whose refusals names CLAUDE.md (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts:76-83 wraps the route in no try/catch, read 2026-09-09)
- [x] #7 the corpus screen given that report renders text naming CLAUDE.md and does not render 'Could not load the corpus.' (client/src/corpus/corpus-page.tsx:40 pins that text to query.isError, read 2026-09-09)
- [x] #8 the live corpus report is unchanged at 122 files, digest c7000b, zero refusals (measured 2026-09-09, tmp-probe/probe1.ts, as a regression guard)
- [x] #9 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split out of ACT-135's review, 2026-09-09, where it was ACT-135 AC#6 and could not be checked.

AC#6 there reads: 'a corpus root whose CLAUDE.md is itself a symlink resolving outside it still makes GET /api/corpus refuse rather than reporting a partial corpus, and the refusal names CLAUDE.md'. Two of ACT-135's six reviewers found independently that its two tests build the fixture with directorySource, while serve.ts:53 wires liveCorpusSource(). refuseUncontained returns early for kind === 'live' (corpus-file.ts:128-130), so the criterion holds on the tested route and not on the one the operator uses.

I reproduced it rather than relaying it. Same root, CLAUDE.md a symlink to an outside file: kind:'directory' threw 'Corpus file CLAUDE.md resolves outside the corpus source, which would hash bytes the corpus does not hold'; kind:'live' returned digest 641445 over files [CLAUDE.md, skills/build/SKILL.md]. That digest is computed over bytes the corpus does not hold, which is the defect ACT-135's adversarial review caught as B1 and fixed for layout directories, surviving here on the instruction file.

Pre-existing and deliberate, not a regression from ACT-135. The live exemption is documented at corpus-file.ts:106-112: a .claude install is a tree of links, its CLAUDE.md included, so containment against its root would refuse every file it holds. That is the constraint any fix must respect and it is why this is not a one-line change. ACT-135's shaping fenced it off explicitly as ACT-134's territory, so check with ACT-134 before starting; the two may be one piece of work.

Measured on ACT-135, 2026-09-09: the healthy live corpus reports 122 files with zero refusals, so any fix must keep that true.

AC#3 AND AC#4 ADDED 2026-09-09, by the adversarial review of ACT-135's record.

The finding, in the reviewer's words: 'Whoever takes ACT-137 could satisfy
ACT-137's AC#1 ("refuses rather than returning a report with a digest") by
making live throw too, and thereby ship a 500 on the corpus screen -
reintroducing exactly the outage ACT-135 exists to prevent. ACT-137 has no
criterion forbidding that.'

Confirmed against the code this session: src/server/api.ts:76-83 wraps
/api/corpus in no try/catch, so anything corpusReport throws reaches
app.onError and becomes a 500. The reviewer observed it over HTTP on a root
with a symlinked CLAUDE.md: directory source returned 500 with body
{"error":"Corpus file CLAUDE.md resolves outside the corpus source..."}.

So 'refuse' in AC#1 means a named refusal in a 200 report, the shape ACT-135
shipped for layout directories, and not a throw. AC#3 and AC#4 say that as
observable behavior so the criteria cannot be met by regressing ACT-135 AC#7
and AC#8.

Related, 2026-09-09: ACT-134 is the same defect class on the same screen, raised to High this session on a reproduction showing a symlinked layout directory serving a file from outside the corpus under digest '19ddbe' with no refusal. Both cards turn on the live source's exemption. The ACT-135 reflection (doc-55) recommends shaping the two as one question about what the live source may hash, rather than ranking them against each other. Whoever picks either up should read the other first.

Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action shaping then build. Priority High, unchanged.

Route reproduced by triage this run, independently of the card. Root whose CLAUDE.md is a symlink outside it: live source RESOLVED files=[CLAUDE.md, skills/build/SKILL.md] digest=91ec2f refusals=[]; directory source THREW SymlinkedEntryError naming CLAUDE.md. The card's account is exact.

Healthy live corpus re-measured this run: 122 files, digest c7000b, zero refusals. AC#2 still describes reachable behavior.

DECIDED THIS RUN, against doc-55's proposal: this card and ACT-134 stay two cards, not one. doc-55 recommended shaping them as one piece of work; the triage skill's consolidate section allows exactly that as linked cards without a merge, and the merge test fails.

The fact the decision turned on, probed rather than reasoned: refuseUncontained is called only from corpus-file.ts lines 156 and 198. checkpoint.ts never calls it, using resolvesOutside directly at line 214. So ACT-134's captureStageCorpus criterion sits on a different code path from this card's, and the two are separately acceptable. My own first answer was to merge; the probe reversed it. An advisor briefed without my position reached keep-two independently.

ACT-134 now carries a dependency on this card, so this one builds first and ACT-134 reads the predicate it lands. Confirmed by reading the ready list back: ACT-134 left it.

The shared design decision both builds need, recorded once here. Neither card can close under a rule of 'refuse whatever resolves outside the root'. Measured this run: in the operator's live install, the agents, skills and rulebook layout directories are themselves symlinks into a sibling tree, and the root instruction file is a symlink too. That rule would empty every live report and contradicts this card's own AC#2. Whoever shapes this picks a different predicate for what a live source may hash, and records it on the shaping doc, because ACT-134's build inherits it.

Correction, 2026-09-09 (doc-56), to the shared-predicate note above. That note says three layout directories are symlinks. Measured exactly by review and re-checked: the layout kinds are agents, output-styles and rulebook (LAYOUT_DIRECTORY_KINDS, checkpoint.ts line 319). Of those, agents and rulebook are symlinks into a sibling tree and output-styles is an ordinary directory. The root instruction file is a symlink. The skills directory is a symlink too but is NOT a layout kind; it is resolved on its own path by resolveSkillDirectory.

So the inventory the shaping session inherits is two of three layout directories plus the instruction file, not three. The conclusion is unchanged: a blanket 'refuse whatever resolves outside the root' still empties every live report and still contradicts this card's AC#2. Correcting it because a shaping session reasons from this inventory to choose the predicate, and a wrong set is a wrong starting point.

SHAPED 2026-09-09 (doc-58). Two independent review rounds, both 'stop'. The card's original criteria are replaced; the old ones are quoted below so whoever wrote them can correct the rewrite.

REPLACED AC#1: 'with a corpus root whose CLAUDE.md is a symlink resolving outside it, corpusReport under a live source refuses rather than returning a report with a digest'. Replaced because the shaping could not produce a rule that satisfies it. See the blocking question below.

WHAT THE PROBES ESTABLISHED, each re-run by the shaping session:

1. The corpus screen is served by a live source and nothing else. corpusReport has one non-test caller (api.ts:77); the server sets corpusSource once (serve.ts:53) as liveCorpusSource(). --corpus is a flag on run/replay/stale, none of which call corpusReport. So a directory-source-only fix fixes nothing a user sees.

2. Every predicate derived from the corpus root's own contents can be laundered. An anchor at the layout entry is vacuous at the top level (probe2: 'hostile CLAUDE.md contained? true'). Capturing trusted trees by resolving the install's top-level entries resolves THROUGH the hostile link and admits the attacker's target (probe7: 'agents contained? true'). Convergence on a common parent fails the same way. Nothing intrinsic separates a benign top-level link from a hostile one (probe6).

   The rule: trust must come from outside the corpus root. A declared extent is the only form that survives (probe8, extent = [~/.claude, ~/.agents]: every live entry contained, hostile agents/ refused).

3. The symlinked-agents/ half never reaches refuseUncontained. The screen's layout loop calls walkDirectory with rootMayBeALink: source.kind === 'live' (corpus-report.ts:94-96). A fix aimed only at refuseUncontained cannot change it. This matches this card's own triage note.

BLOCKING QUESTION FOR THE OPERATOR, not answerable from any source this session read:

  May the live install's wiring resolve anywhere, or must it stay inside a declared extent, and what is that extent?

Decision-4 says a live corpus is 'the install on the running machine, enumerated and hashed as it is today' and names no extent, which reads as 'anywhere'. On that reading this card and ACT-134 are both working-as-designed. ACT-137/134/135 assert the opposite. The criteria asserting the extent were authored by prior agent sessions, not typed by the operator, so they are the board's claim rather than a direction.

  RECOMMENDATION: the extent is the live install root plus the real path of the tree its layout entries point into, declared as configuration read from outside the corpus root, defaulting on this machine to [~/.claude, ~/.agents]. Declared, not discovered, because a discovered value is one the root can rewrite.

  QUEUED COMMAND once answered, which this session may not run unprompted:
    backlog decision create 'The extent a live corpus install may resolve into'

WHAT IS UNBLOCKED AND SHAPED NOW: the instruction file's hashCorpusFiles call sits outside any try (corpus-report.ts:81-86) while the layout loop below wraps every directory, so a SymlinkedEntryError on CLAUDE.md becomes a 500. That is the outage ACT-135 AC#7 exists to prevent, it reproduces today (probe5), and it is a prerequisite for any answer to the extent question: the moment live containment refuses anything, without this the operator's own corpus screen becomes an error page. The five acceptance criteria now on this card are that work.

Two things the builder must handle, both from review: the refusal message names no absolute path so redactAbsolutePaths is a no-op on it; and the client's refusal block (corpus-page.tsx:54-66) prints fixed prose about a 'layout directory', which is false for the instruction file.

CONSUMER COUNT for the extent-dependent build, when unblocked, counted across two review rounds because the first count was incomplete: corpus-report.ts:125,135; staleness-report.ts:112,286,306; corpus-source.ts:103,107,127; session-corpus.ts:70,87,164 reaching session-run-command.ts:90 which passes a SessionCorpusSnapshot where a CorpusRoot is expected; calibration.ts:459 which calls resolveCorpusFile(liveCorpusSource(), ...) synchronously so an async liveCorpusSource breaks it; checkpoint.ts:262 stageCorpusRoots which gives live a PAIR of roots so the extent must say which it is captured against. Recorded checkpoint hashes come from captureStageCorpus over LAYOUT_DIRECTORY_KINDS, a different set from the screen's, so the screen digest holding at c7000b says nothing about lineage.

ACT-134 inherits no predicate, because there is not one. It inherits the finding that no derived predicate works and the same operator question. Both cards are blocked on one decision, which argues for answering it once rather than per card.

DECIDED BY THE OVERSEEING ITERATE SESSION, 2026-09-09, on the extent question doc-58 raised. Nobody was at the keyboard, so the Acting rule for an unattended session applies: the shaping session's recommendation is taken, with the reason recorded here.

The answer: a declared extent, not "anywhere". The extent is the live install root plus the real path of the tree its own layout entries point into, read as configuration from outside the corpus root, defaulting to [liveCorpusRoot(), <that tree>], which is [~/.claude, ~/.agents] on this machine.

Doc-58 read decision-4 as saying "anywhere" and therefore as possibly invalidating this card. I read decision-4 and it does not settle the question that way. Two passages bear on it:

- "A live corpus is the install on the running machine, enumerated and hashed as it is today." Doc-58 takes this as permission to resolve anywhere. It is a statement about WHEN the corpus is read (today, not frozen), not about WHERE it may point. The sentence is about staleness, which is the section's subject.
- "The harness stops depending on the shape of one machine's dotfiles for its core behavior, and gains a boundary where a home directory is parsed once into a corpus it controls." This is the decision asking for exactly the boundary doc-58 recommends. A declared extent IS that boundary. "Anywhere" is the absence of one.

So the recommendation is not merely the unattended default here; it is the reading decision-4 supports. Recorded as the decision this card and ACT-134 both build on.

What this does NOT decide: whether a refusal or some weaker signal is right when an entry leaves the extent. That is design, and it belongs to the build, constrained by AC#2 (the live report must still return its files) and AC#3 (200 with a refusal, never a 500).

OBSERVED BY THE SAME SESSION, a cost doc-58 did not weigh, for whoever builds Change B. The instruction file's placement outside the layout loop's try/catch is deliberate and documented, not an oversight. src/server/corpus-report.ts:70-74 reads: "The instruction file is hashed outside that tolerance: a corpus whose CLAUDE.md is not the corpus's own bytes is one the harness cannot identify, rather than a partial corpus to show."

Change B reverses that stated intent. AC#3 and AC#4 on this card override it, and I verified the placement is as doc-58 describes (the hash at lines 81-86 sits above the try at line 92), so the change is still right. But the builder is changing a documented decision rather than fixing an oversight, and the comment must be rewritten to say why a named refusal now beats an unidentifiable corpus. Leaving that comment standing beside the opposite behavior is the defect this note exists to prevent.

BUILT 2026-09-09. Four commits: 68681af (the fix), ec2eb0e (the API test), ae65699 and 5006b6c (the client copy).

WHAT CHANGED. hashCorpusLayout's instruction-file hash now sits inside the same try/catch the layout loop already used, so a SymlinkedEntryError on CLAUDE.md becomes a refusal string instead of reaching app.onError as a 500. corpusReport already withholds the digest whenever refusals is non-empty, so no other change was needed for the digest half. The comment above hashCorpusLayout, which argued the opposite ('a corpus whose CLAUDE.md is not the corpus's own bytes is one the harness cannot identify'), was rewritten to say why a named refusal now beats an unidentifiable corpus, as the previous session's note required.

The client's refusal block claimed 'their layout directory is missing from the table whole', which is false for CLAUDE.md. It now reads 'These entries could not be hashed, so they are missing from the table, and a refused layout directory is missing from it whole:'. Branching on the refusal's kind was rejected: the report carries refusals as opaque strings, so the client would have to parse a message to recover a kind the server already knows.

AC#1 REMOVED FROM THIS CARD, moved to ACT-141. It read: 'with a corpus root whose CLAUDE.md is a symlink resolving outside it, corpusReport under a live source refuses rather than returning a report with a digest'. It is quoted here so whoever wrote it can correct the move. It was removed because it is the extent-dependent half doc-58 fenced off: refuseUncontained returns early for kind === 'live', and removing that exemption without the declared extent empties every live report, contradicting the criterion directly beside it. ACT-134 now depends on ACT-141 as well as this card.

WHAT I OBSERVED, all this session. Ran the real HTTP server with a directory source pointed at a root whose CLAUDE.md symlinks to /tmp/act137-outside/secret.md: GET /api/corpus returned status 200, body refusals ['Corpus file CLAUDE.md resolves outside the corpus source, which would hash bytes the corpus does not hold'], no digest field, and the string 'SECRET BYTES' nowhere in the response. Rendered CorpusPage against that captured server body in happy-dom: the alert read 'These entries could not be hashed, so they are missing from the table, and a refused layout directory is missing from it whole:Corpus file CLAUDE.md resolves outside the corpus source...' and 'Could not load the corpus.' was absent. Ran corpusReport against the live install: 122 files, digest c7000b, zero refusals. Full suite 1346 + 106 pass 0 fail; lint, typecheck and fmt:check clean.

WHAT I DID NOT OBSERVE. The screen in a real browser. No Chrome, Chromium, Playwright or Puppeteer is installed on this machine, so the closest evidence is the component rendered in happy-dom against the running server's own response body rather than a hand-written stub. The bundle served by client/dist was rebuilt and served, but never painted by a browser engine.

TDD NOTE, honestly. The corpusReport test was red first, by throwing, as predicted. The API test was written after the fix and passed immediately; I reverted the fix and re-ran to confirm it fails without it, so it guards the route rather than passing vacuously. The client copy test was red first. The second client test (a refusal naming the instruction file) passed on writing, because the component renders any refusal string.

REVIEWED TWICE, 2026-09-09, both rounds by an unprimed reviewer. Ten findings then nine. Disposition below; every one closed.

FIXED HERE, each reproduced by this session before fixing rather than taken on the reviewer's word:

- A dangling, self-referential, or directory-targeted CLAUDE.md read as 'this corpus has no CLAUDE.md' and served digest 4f53cd, the digest of zero files, with no refusal. The exists() guard follows the link, so a broken link and an absent file were indistinguishable. Now lstat sees the link and stat sees the target, and the two disagreeing is the signal (commit 1aa317b).
- An unreadable CLAUDE.md (chmod 000) threw EACCES, so the route 500'd with a message naming the file only as <path>, because redactAbsolutePaths had replaced its one identifying token (commit 265eb20).
- A CLAUDE.md symlinked to /dev/null 500'd with 'Corpus file CLAUDE.md does not exist', which is false: hashCorpusFiles reports a device as absent. A CLAUDE.md that is a FIFO was worse, the read blocks on a pipe with no writer and the request NEVER RETURNS, so the screen waits on 'Loading…' forever and the server holds the task. A test for it times out rather than failing. Only a regular file holds instruction bytes now (commit 90c61f2).
- ELOOP was reported with checkpoint.ts's wording for a dangling link, 'is a link whose target is missing'. False for a loop: the target exists and following it is what does not end. It has its own sentence now (commit 76b8349).
- The API test asserted the body did not contain the outside file's bytes, which no code path could have put there, since hashCorpusFiles emits a sha256 and never content. It asserts the file list is empty instead. A client test asserting 'Could not load the corpus.' is absent was removed: its fixture stubs a 200, so the error branch cannot render under any component that shows a success branch at all (commit 9df1103).

FILED, because each fix lands in a file this card never touched:
- ACT-142: GET /api/runs still 500s on the same corpus state, through staleness-report.ts:181 which calls readCorpusInstructions outside any try. I confirmed the throw at the source; the reviewer reproduced the HTTP 500.
- ACT-150: an unreadable or self-referential file INSIDE a layout directory still 500s the corpus screen, through the walk in checkpoint.ts. Reproduced by this session: EACCES and ELOOP both thrown before any report was returned.

ACCEPTED AND NOT ACTED ON, with the reason:
- Nothing pins redactAbsolutePaths on the CLAUDE.md refusal path: the reviewer removed the call and the suite stayed green. I wrote a test for it, then confirmed by mutation that MY TEST DID NOT KILL THE MUTANT EITHER, because the SymlinkedEntryError message genuinely carries no path, so the redaction is a no-op there and nothing observable changes. I removed the test rather than leave one that asserts something true by construction. The finding stands unclosed: if that message ever grows a path, no test will notice. The layout walk's path-carrying refusal IS pinned by an existing test.
- The report's root field is an absolute path served unredacted to the browser. Pre-existing and deliberate, pinned by api.test.ts as 'the operator declared it and the server is theirs'.

STRUCTURAL FINDING, on the record for ACT-150: 'how a corpus entry fails to be hashable' is now knowledge in two places. The walk classifies two states, this file classifies five for the instruction file, and the walk's two are a subset. A third copy should not be added; either the walk grows the missing states or both read one classifier.

FINAL OBSERVATION, over real HTTP through createApiApp, after the last commit: device 200, fifo 200, escaping 200, unreadable 200, each with a refusal naming CLAUDE.md and no digest; healthy 200 with digest a711ea. Live corpus 122 files, digest c7000b, zero refusals. Suite 1353 + 105 pass, 0 fail; lint, typecheck, fmt:check clean.

Triage title correction, 2026-09-09 (doc-61): previous title described live containment, which remains on ACT-141. The new title names the delivered refusal/report behavior; filename is unchanged. Original title: GET /api/corpus reports a confident digest over a symlinked CLAUDE.md when the source is the live corpus. Source: doc-60 reflection and fresh route probes.
<!-- SECTION:NOTES:END -->
