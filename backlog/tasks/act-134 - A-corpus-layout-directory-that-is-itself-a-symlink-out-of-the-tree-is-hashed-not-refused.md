---
id: ACT-134
title: >-
  A corpus layout directory that is itself a symlink out of the tree is hashed,
  not refused
status: To Do
assignee: []
created_date: '2026-09-09 01:07'
updated_date: '2026-09-09 12:59'
labels: []
dependencies:
  - ACT-137
priority: high
ordinal: 130008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 with agents/ in a corpus root replaced by a symlink to a directory outside that root, captureStageCorpus refuses rather than returning the outside directory's files as agents/<name> (probed 2026-09-09 during ACT-130 review: it returned agents/leak.md hashing SECRETBYTES from a separate temp dir, no throw)
- [ ] #2 the containment rule c9ffe4d states, that an entry is judged by where it resolves, holds for a layout directory as it does for an entry inside one (commit c9ffe4d: 'Containment is the rule that survives')
- [ ] #3 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
- [ ] #4 against a corpus root whose agents/ is itself a symlink to a directory outside the root, GET /api/corpus returns 200 carrying a refusal that names agents, no digest, and no file from the outside directory among the files (reproduced 2026-09-09 by triage: the live source returned files=[CLAUDE.md, skills/build/SKILL.md, agents/stolen.md] with digest 0f939c and zero refusals, serving a file from outside the corpus as corpus data)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found during the ACT-130 code review (2026-09-09), by a reviewer probe, then reproduced directly this session.

Mechanism: captureStageCorpus (src/benchmark/checkpoint.ts:270-300) passes
rootMayBeALink: true at all three hashDirectory call sites, which skips refuseIfLink
for the root. Inside the walk, resolvesOutside(root, absolute) compares each entry
against the linked directory as its own root, so nothing under it resolves outside
and every file is hashed with the layout prefix. The corpus root's own containment
is never checked for that directory.

Reproduction: build a corpus root with CLAUDE.md and skills/build/SKILL.md, create a
separate temp dir holding leak.md, then symlink that dir to <corpus>/agents, and call
captureStageCorpus('build', 'hi\n', [corpus]). Observed 2026-09-09: returned
[CLAUDE.md, agents/leak.md, skills/build/SKILL.md] with no throw, hashing bytes the
corpus does not hold.

Pre-existing, not introduced by ACT-130: the three rootMayBeALink call sites are
untouched by that change (git diff 5338c41..b367a6c on checkpoint.ts matches
rootMayBeALink zero times). Recorded there as failing the revert test.

Relation to ACT-113 and c9ffe4d: both closed the entry-level version of this leak.
This is the directory-level hole the same rule leaves open. Whether the fix is to
check the layout directory's own containment against the corpus root, or to pass
rootMayBeALink: false with the live-corpus case handled separately, is open.

Note the live corpus case is why rootMayBeALink: true exists at all: the operator's
own ~/.claude layout directories are themselves symlinks (recorded in ACT-130's
shaping under Reproduction). A fix that simply flips the flag would refuse every live
corpus. Check that before choosing the approach.

Triage 2026-09-09: priority Medium.

Not High, and the reason is the threat model rather than the mechanism. This is a real containment hole and it is on a shipped surface, but a corpus arrives as data a case author declares, so reaching it means the author symlinked a layout directory out of their own tree. That is a foot-gun, not an attacker path. ACT-132 and ACT-130 were High because one was an open leak on every read surface and the other was a live outage; this is neither.

Not Low: it defeats the containment rule c9ffe4d established, on the same surface that rule was written for, so leaving it means the guard's stated invariant is false and the next reader believes it.

Relation to ACT-133, both filed off the same review: ACT-133 (hardlink) cannot be closed by any path-based guard and its own card says the first question is whether to close it at all. ACT-134 CAN be closed by a path-based guard, since a layout directory's own containment against the corpus root is checkable. So ACT-134 is the actionable one of the pair and ranks above ACT-133.

Warning the card already carries and triage confirms is load-bearing: rootMayBeALink: true exists because the operator's own ~/.claude layout directories ARE symlinks. Verified this run, independently of the card: 'find ~/.claude/agents ~/.claude/skills -type l' returns both ~/.claude/agents and ~/.claude/skills themselves. So flipping the flag refuses the live corpus outright. Whoever builds this must keep the live source working; that is not a hypothetical.

Precision on the live-corpus warning, triage 2026-09-09 after review. The note above says 'its layout directories are themselves symlinks'. Measured exactly, by 'ls -la ~/.claude/': agents, skills and rulebook are symlinks into ~/.agents, and CLAUDE.md is a symlink to ~/.agents/AGENTS.md. output-styles is an ordinary directory.

So it is three of four layout directories plus the instruction file, not all of them. The conclusion is unchanged and if anything firmer: flipping rootMayBeALink to false would refuse the live corpus on any of four entries, not just one.

Raised Medium -> High by the overseeing iterate session, 2026-09-09, on evidence that did not exist when the priority was set.

This card's criteria name captureStageCorpus. The same mechanism also reaches the corpus screen, which the card does not mention. Reproduced this session against the code as it stands after ACT-135 shipped: a root holding CLAUDE.md plus an agents/ that is a symlink to an unrelated directory outside the root returned

  files=CLAUDE.md,agents/stolen.md   digest='19ddbe'   refusals=[]

So a file that lives entirely outside the corpus is served to the browser as ordinary corpus data, under a confident digest, with no refusal naming it. ACT-135 shipped the refusal for entries inside a layout directory; a layout directory that is itself the link is not covered, and the report presents foreign bytes as corpus rather than failing honestly.

Found by the ACT-135 reflection and independently reproduced here. Same defect class as ACT-137: both put foreign bytes behind a confident digest on the same screen, and both turn on the live source's exemption, which exists because ~/.claude's own layout directories are symlinks into ~/.agents. The reflection's recommendation is to shape the two as one question about what the live source may hash rather than ranking them against each other.

Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build, after ACT-137. Priority High, unchanged from the raise the previous run made.

Route reproduced by triage this run, independently of the card and of doc-55. Root whose agents/ is a symlink to an outside directory holding stolen.md: live source RESOLVED files=[CLAUDE.md, skills/build/SKILL.md, agents/stolen.md] digest=0f939c refusals=[]. So a file from entirely outside the corpus is served as ordinary corpus data under a confident digest. The directory source, by contrast, RESOLVED with digest undefined and a refusal naming agents, which is the degradation ACT-135 shipped.

AC#4 added this run. The screen route was recorded only in these notes and had no criterion, so the screen half of this card had no home in its acceptance. Source is the reproduction above. Found by the advisor's scope-accounting check, confirmed against the card.

Dependency on ACT-137 added this run. Reason: both routes turn on the same live-source exemption, and the predicate ACT-137's shaping settles is the one this build inherits. Without the dependency the picker would take this card first, since its lower ID sorts above ACT-137 at equal priority, and the second build would re-decide the containment rule. Verified by reading the ready list back: this card left it, so the picker cannot take it until ACT-137 is Done.

Not merged into ACT-137, deciding against doc-55's proposal to shape them as one piece of work. The probe that settled it: refuseUncontained is called only from corpus-file.ts lines 156 and 198, never from checkpoint.ts, which uses resolvesOutside directly at line 214. This card's AC#1 names captureStageCorpus, a path that never reaches refuseUncontained, so the two cards are separately acceptable and the merge test fails. doc-55's intent is served by the dependency and the shared predicate recorded on ACT-137.
<!-- SECTION:NOTES:END -->
