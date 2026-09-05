---
id: ACT-81
title: >-
  a seeded board leaves the target dirty, failing every stage the harness
  scaffolds
status: Done
assignee: []
created_date: '2026-09-05 12:47'
updated_date: '2026-09-05 13:17'
labels: []
dependencies: []
type: bug
ordinal: 77008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The harness ran `backlog init`, which puts a board at backlog's own default. A target that never opted into a board leaves that untracked, and the harness writes no commit for the board it creates, so the stage was failed for a dirty worktree holding the harness's own scaffolding.

This stopped every audit-log run. An opus run at high effort scored A on all four dimensions and passed every requirement, and still stopped here, which is what shows the shaping was never the cause.

The seeding tests passed throughout because the fixture writes a `.gitignore` carrying `backlog/` (test-support.ts:34), a condition no real target meets.

Fixed by copying `~/.agents/backlog-config.yml`, which names `.boris/backlog`. Verified on a real repository: board seeded, worktree clean, the target's own `.gitignore` untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Seeding a board in a target that ignores no workflow state leaves the worktree clean
- [x] #2 The target's own .gitignore is not modified
<!-- AC:END -->
