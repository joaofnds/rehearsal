---
id: ACT-134
title: >-
  A corpus layout directory that is itself a symlink out of the tree is hashed,
  not refused
status: To Do
assignee: []
created_date: '2026-09-09 01:07'
updated_date: '2026-09-09 01:07'
labels: []
dependencies: []
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
<!-- SECTION:NOTES:END -->
