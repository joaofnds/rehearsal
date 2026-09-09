---
id: ACT-134
title: >-
  A corpus layout directory that is itself a symlink out of the tree is hashed,
  not refused
status: To Do
assignee: []
created_date: '2026-09-09 01:07'
updated_date: '2026-09-09 10:39'
labels: []
dependencies: []
priority: medium
ordinal: 130008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 with agents/ in a corpus root replaced by a symlink to a directory outside that root, captureStageCorpus refuses rather than returning the outside directory's files as agents/<name> (probed 2026-09-09 during ACT-130 review: it returned agents/leak.md hashing SECRETBYTES from a separate temp dir, no throw)
- [ ] #2 the containment rule c9ffe4d states, that an entry is judged by where it resolves, holds for a layout directory as it does for an entry inside one (commit c9ffe4d: 'Containment is the rule that survives')
- [ ] #3 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
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
<!-- SECTION:NOTES:END -->
