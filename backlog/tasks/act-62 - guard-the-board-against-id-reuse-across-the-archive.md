---
id: ACT-62
title: guard the board against id reuse across the archive
status: To Do
assignee: []
created_date: '2026-09-04 17:16'
updated_date: '2026-09-04 17:17'
labels: []
dependencies: []
priority: high
type: chore
ordinal: 59008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `backlog` CLI (upstream backlog.md, installed 1.51.0 via Homebrew, which is
also the latest published version) excludes `backlog/archive/tasks/` from the id
scan set. That one omission causes both symptoms observed on this board.

Reproduced end to end in a scratch board on 2026-09-04, not inferred:

- Created TASK-1..TASK-3, archived TASK-2 and TASK-3, then `backlog task create`
  issued TASK-2 again, and a further create issued TASK-3 again. Allocation reads
  live cards only.
- `backlog doctor` on that board reported "No duplicate IDs, self-referential
  dependencies, or dependency cycles found" and exited 0.
- Planting a duplicate id in `backlog/tasks/` instead made doctor report the
  group and print a repair preview. Doctor's duplicate detection is correct; its
  scan set is what has the hole.

The failure mode is worse than a silent collision. `backlog task <id>` and
`backlog task edit <id>` resolve a colliding id silently to the live file with no
warning, so most commands appear to work. Only `--dep` refuses, with:

    Task ID TASK-2 is ambiguous; 2 files match: ...
    Run 'backlog doctor' to preview a safe repair.

That instruction is a dead end: doctor then reports the board clean. A user
following the error's own advice is told nothing is wrong.

`backlog doctor --help` states it reads "Active and completed task files,
document, decision, and draft files". The archive is neither active nor
completed, so the documented scan set matches the behavior. This is a design gap
upstream rather than a regression.

## State of this board

Ids ACT-52 through ACT-58 were archived (an earlier UI card set) and ACT-52 and
ACT-53 were then reissued to live cards. A full scan of live plus archive
frontmatter shows exactly two remaining duplicate groups, ACT-52 and ACT-53. The
card created earlier this session was renumbered by hand to ACT-59 to clear its
own collision.

Three live cards carry dependencies on the ambiguous ids: ACT-50 depends on
ACT-52 and ACT-53, ACT-51 depends on ACT-52 and ACT-53, and ACT-53 depends on
ACT-52. Those edges are stored as bare id strings, so which card they point at is
decided by whatever resolves the id later. They read as the live cards today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creating a new card on a board whose archive holds the highest id issues an id above that archived id, not a reused one
- [ ] #2 A board carrying an id present in both backlog/tasks and backlog/archive/tasks is reported as a duplicate group by the check we run, naming both file paths
- [ ] #3 The ACT-52 and ACT-53 collisions on this board are resolved, and a full scan of live plus archive frontmatter reports no duplicate id groups
- [ ] #4 The dependency edges on ACT-50, ACT-51, and ACT-53 that name ACT-52 and ACT-53 resolve to the intended live cards after the collision is resolved
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Decision on the two questions

Both answers are yes on the merits, and neither is ours to implement. The
behavior belongs to a compiled upstream binary (the installed `cli.js` is a
70MB-binary launcher, not patchable source), so the routes available are an
upstream report, a wrapper, or a convention.

1. Should `backlog doctor` scan the archive and report cross-archive duplicates?
   Yes. Doctor already owns duplicate-id diagnosis and repair, and the ambiguity
   error explicitly directs users to it. Reporting clean while a command refuses
   on the same id is the single worst part of this, because it strands the user
   with no next step. Archived cards do not need renaming, so the archive should
   be scanned and reported, not repaired: the live card is the one to renumber.

2. Should allocation consider archived ids so a new card never reuses one?
   Yes. An id is a permanent handle. Archived cards keep their ids, remain
   referenced from commit messages, dependency lists, and prose in live cards,
   and are the reason someone reads the archive at all. Reuse makes those
   references silently wrong rather than merely dangling, which is the more
   damaging failure. The next id should be one past the highest id ever issued.

Rejected: renumbering the archived ACT-52..58 cards to free the ids. It rewrites
history that commit messages and card prose already reference, to save nothing.

## Recommended fix, in order

The first step is the local guard, because it is the only one that protects this
board on a timeline we control.

A wrapper is preferred to a convention. A convention ("remember to check the
archive") is vigilance, and vigilance is what already failed here. Prefer a guard
the system enforces. The wrapper should scan live plus archive frontmatter for
the highest issued id, and refuse or correct a create that would reuse one.

An upstream report to MrLesk/Backlog.md carries both findings, with the scratch
reproduction above, and needs Joao's direction before filing.
<!-- SECTION:NOTES:END -->
