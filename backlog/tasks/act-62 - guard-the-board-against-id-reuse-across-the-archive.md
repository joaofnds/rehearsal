---
id: ACT-62
title: fix backlog id reuse across the archive upstream
status: To Do
assignee: []
created_date: '2026-09-04 17:16'
updated_date: '2026-09-04 17:33'
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
- [ ] #1 An issue is filed on MrLesk/Backlog.md describing both defects with the reproduction, and its number is recorded on this card
- [ ] #2 A PR is open upstream that makes duplicate-ID diagnosis report a group spanning backlog/tasks and backlog/archive/tasks, naming both paths and exiting non-zero
- [ ] #3 The upstream position on whether allocation should stop reusing archived ids is recorded on this card, whether accepted, rejected, or split out
- [ ] #4 The ACT-52 and ACT-53 collisions on this board are resolved, and a scan of live plus archive frontmatter reports no duplicate id groups
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

## Decision, 2026-09-04: no local wrapper

Joao's direction: we will not build a local wrapper for this. It is an upstream
defect and it gets fixed upstream. The earlier recommendation in these notes for
a wrapper that refuses a create reusing an archived id is withdrawn. Do not build
one, and do not add a convention that asks a session to check the archive by hand.

This leaves the board unguarded against a further collision until upstream ships
a fix. That is accepted. The exposure is small and bounded: a collision only
occurs when a new card is created while the highest ids sit in the archive, and
the two existing collisions are already recorded below.

## Findings from reading the upstream source

Read from a clone of MrLesk/Backlog.md at 3c7fde6, so these are file-level facts
rather than inference from CLI behavior.

The id reuse is deliberate, not an oversight. Three comments assert it, e.g.
above `getExistingIdsForType` in `src/core/backlog.ts`: "Archived tasks are
intentionally excluded - archived IDs can be reused. This makes archive act as a
soft delete for ID purposes." An upstream fix for allocation therefore has to
win a design argument and may be rejected.

Both symptoms share one root: `liveRecords()` in
`src/core/task-identity-index.ts` keeps only records of type "task" and
"completed". `getOccupiedIds()` feeds allocation through that filter, and
`getContestedIds()` feeds duplicate detection through the same filter.

The doctor half is a plain bug regardless of the design argument.
`src/core/duplicate-task-repair.ts` never mentions the archive, while the
ambiguity error raised from `src/utils/task-path.ts` tells the user to run
`backlog doctor`. Reads and edits stay silent because `getTaskPath` scans only
`tasksDir` and `completedDir`.

## Next action

A prompt for an implementing session was written to
tmp/backlog-archive-id-prompt.md (untracked scratch, not repo content). It opens
an issue and a PR against MrLesk/Backlog.md, splitting the doctor fix from the
allocation change so the doctor fix can merge even if the soft-delete design is
defended. Joao runs that session in a clone of the upstream repo.

This card is now a tracking card for that upstream work. Nothing in this
repository changes.
<!-- SECTION:NOTES:END -->
