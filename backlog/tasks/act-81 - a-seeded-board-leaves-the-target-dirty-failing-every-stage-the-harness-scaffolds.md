---
id: ACT-81
title: >-
  a seeded board leaves the target dirty, failing every stage the harness
  scaffolds
status: Done
assignee: []
created_date: '2026-09-05 12:47'
updated_date: '2026-09-05 12:47'
labels: []
dependencies: []
type: bug
ordinal: 77008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
seedTaskBoard creates a board in the target and writes no commit for it, on the documented assumption that the board lives under the target's ignored workflow state (backlog.ts:77-82). Targets do not ignore it. The harness then fails the stage for a dirty worktree, on files the harness itself created.

This failed every audit-log run. The blocker fired on '?? backlog/config.yml' and the stage's own card files, with the stage graded F regardless of its content. An opus run at high effort scored A on all four dimensions and passed every requirement, and still stopped here, which is what shows the shaping was never the cause.

The suite did not catch it because the test fixture writes a .gitignore containing 'backlog/' (test-support.ts:34), so every seeding test ran against a condition no real target meets. The new test drops those ignores and reproduces '?? backlog/' exactly.

Fixed by excluding the workflow-state paths through the repository's private .git/info/exclude. That leaves the target's own .gitignore untouched, which the harness's comment says is deliberate: the target's files are a property of the repository under test.

Verified on a real repository outside the suite: after seeding, the worktree is clean, the board exists, and the target's .gitignore still reads only what it had.

Note: .boris/backlog is João's convention for boards, set by backlog_directory in a root backlog.config.yml. I tried seeding there and backlog init ignored a pre-existing config and created backlog/ anyway, then refused to read the board after it was moved. Recorded here because a later session will reach for that layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Seeding a board in a target that ignores no workflow state leaves the worktree clean
- [x] #2 The target's own .gitignore is not modified
<!-- AC:END -->
