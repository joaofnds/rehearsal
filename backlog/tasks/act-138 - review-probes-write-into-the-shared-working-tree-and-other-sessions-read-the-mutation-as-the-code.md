---
id: ACT-138
title: >-
  review probes write into the shared working tree, and other sessions read the
  mutation as the code
status: To Do
assignee: []
created_date: '2026-09-09 11:38'
updated_date: '2026-09-09 11:38'
labels: []
dependencies: []
type: bug
ordinal: 134008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a session running mutation probes leaves the repository working tree as it found it, or the damage is detected and named, rather than another session silently measuring the mutant as if it were HEAD (observed 2026-09-09 during ACT-135's review: two of this session's own probe measurements were void because they read src/benchmark/checkpoint.ts while a reviewer held a mutation in it)
- [ ] #2 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found during ACT-135's review round, 2026-09-09, and it is the same class of
defect ACT-135 itself was filed about, one directory over.

WHAT HAPPENED. Five reviewers ran mutation probes against a single shared
working tree at /Users/joaofnds/code/rehearsal while other sessions were
reading it. Observed this session:

- src/benchmark/checkpoint.ts carried a live mutation (the throw block deleted
  from hashDirectory) while I probed hashDirectory. I recorded 'hashDirectory
  NO THROW' and began building a finding on it. The finding was void: I was
  measuring the mutant, not HEAD. Re-run against clean HEAD, hashDirectory
  throws as designed.
- client/src/corpus/corpus-page.tsx carried a .slice(0, 1) mutation while the
  adversarial reviewer ran the suite. It got 0, 8, 9, 1 and 0 failures across
  five consecutive runs and traced the flakiness to the shared tree rather than
  to the build under review.
- Untracked probe files appeared in the repository: src/benchmark/scratch-ck.ts,
  src/benchmark/probe1.test.ts, costprobe.ts. Each was cleaned up by its author.
- One reviewer's git stash pop dropped another's mutation; it recovered the
  file from an unreachable stash commit.

WHY IT MATTERS BEYOND THE NUISANCE. A mutation in the tree is indistinguishable
from the committed code to any session that reads a file rather than
git show HEAD:<path>. Two measurements this session were wrong in exactly that
way, and both were headed for a card. The failure mode is a session reporting a
defect that does not exist, or missing one that does, with the evidence looking
clean either way.

ROUTES, none taken here.
1. A git worktree per reviewer. Creating one is reserved for a typed
   instruction, so this session could not.
2. Reviewers copy the repo to a temp root before mutating. Cheap, and within a
   brief's reach, but it depends on every brief remembering to say it.
3. A PreToolUse hook denying writes under the repo from a reviewer sub-agent.
   The enforcement point is the harness's own settings, which the hard line
   reserves for an instruction typed into the session that writes them.
4. Reviewers read git show HEAD:<path> rather than the working tree for any
   claim about committed behavior, and say so when they mutate. Does not stop
   the collision, only stops one session's claim resting on another's mutant.

RELATION TO ACT-135. That card's prevention half, already queued there, is a
hook denying writes under ~/.claude and ~/.agents. It does not cover the
repository working tree, which is where this happened. Whoever takes the
prevention ask should cover both or say why not.

QUEUED FOR A TYPED INSTRUCTION, not actionable here: whether reviewers get
worktrees, and whether a hook should bound where a review sub-agent may write.
Both edit surfaces the hard lines reserve.
<!-- SECTION:NOTES:END -->
