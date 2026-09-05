---
id: ACT-72
title: the baseline guard says which condition failed and which paths were dirty
status: Done
assignee: []
created_date: '2026-09-04 23:57'
updated_date: '2026-09-05 00:21'
labels: []
dependencies: []
type: bug
ordinal: 68008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-05 while diagnosing the third failed shape run of the audit-log case.

'Target baseline changed unexpectedly' is thrown from two call sites in src/benchmark/target.ts, lines 223 and 257, each covering three distinct conditions: the branch is not the expected one, HEAD is not the expected SHA, or 'git status --porcelain=v1 --untracked-files=all' is non-empty. The run artifact records the bare string as input.harnessFailure and nothing else.

The cost is concrete. ACT-64 was filed against the first occurrence and attributed it to the agent writing the task file directly. The second occurrence has a different cause, an unclean worktree from uncommitted workflow artifacts, and telling them apart required reading the guard's source to learn the message covers both. A card was scoped on the wrong cause because the message does not distinguish them.

This is the same family as ACT-70 and ACT-71: the harness knows something at failure time and drops it before it reaches the artifact. Here the guard has already run 'git status' and holds the dirty paths when it throws.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A stage validation failure names which condition fired: wrong branch, wrong SHA, or dirty worktree
- [x] #2 A dirty-worktree failure records the offending paths in the run artifact
- [x] #3 Diagnosing a baseline failure from the artifact alone requires no reading of harness source
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session that hit this diagnosing ACT-39's third failed run. Blocks nothing directly, but it made ACT-64's diagnosis wrong once and would do so again.

Fixed and verified 2026-09-05, commit on trunk.

Both call sites in src/benchmark/target.ts now branch per condition. A wrong branch says which branch and which was expected, a wrong commit names both SHAs, and a dirty worktree lists the paths from the git status the guard had already run.

Five tests pin it, one per condition at each call site, each confirmed red before the fix with the old shared message and green after. Full suite 1011 pass 0 fail, typecheck, lint, and fmt:check all clean, observed this session.

Not verified: no live run has hit the new messages. The next audit-log run is the confirmation, and it is the run ACT-64 needs anyway.
<!-- SECTION:NOTES:END -->
