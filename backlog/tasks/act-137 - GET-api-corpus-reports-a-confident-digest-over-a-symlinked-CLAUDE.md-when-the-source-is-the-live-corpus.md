---
id: ACT-137
title: >-
  GET /api/corpus reports a confident digest over a symlinked CLAUDE.md when the
  source is the live corpus
status: To Do
assignee: []
created_date: '2026-09-09 11:16'
updated_date: '2026-09-09 13:11'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-56 - triage-2026-09-09-c.md
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
- [ ] #1 with a corpus root whose CLAUDE.md is a symlink resolving outside it, corpusReport under a live source refuses rather than returning a report with a digest (reproduced 2026-09-09 on ACT-135: kind:'directory' threw 'Corpus file CLAUDE.md resolves outside the corpus source', kind:'live' on the same root returned digest 641445 over files [CLAUDE.md, skills/build/SKILL.md])
- [ ] #2 the live corpus still reports its files, since ~/.claude's own layout directories are symlinks into ~/.agents and refusing them would empty every report (measured on ACT-135: corpusReport(liveCorpusSource()) returns 122 files with zero refusals)
- [ ] #3 against that same root, GET /api/corpus returns 200 carrying a refusal that names CLAUDE.md, not a 500 (adversarial review of ACT-135's record, 2026-09-09: api.ts:76-83 wraps the route in no try/catch, so satisfying AC#1 by throwing would return the 500 that ACT-135 AC#7 exists to eliminate)
- [ ] #4 the corpus screen against that root renders the refusal naming CLAUDE.md rather than 'Could not load the corpus.' (same review: ACT-135 AC#8 pins that text for the layout-directory case, and this route must not regress it)
- [ ] #5 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
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
<!-- SECTION:NOTES:END -->
