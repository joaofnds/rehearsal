---
id: ACT-139
title: iterate reports a reflect step as successful when the stage produced nothing
status: To Do
assignee: []
created_date: '2026-09-09 11:41'
updated_date: '2026-09-09 11:41'
labels:
  - bug
dependencies: []
priority: high
ordinal: 135008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
iterate's step() Done branch runs the reflect session and then checks only refuseWorkLeftBehind(), which refuses uncommitted changes. A reflect session that writes nothing at all leaves nothing uncommitted, so it passes that guard, and step() prints '<card> is Done' and exits 0.

Observed 2026-09-09 on ACT-135: the reflect session ended after a single turn having emitted only its rule-file announcement ('Reading: ~/.agents/rulebook/backlog-board.md'), at $0.10 and 1 turn against a 58- and 130-turn shape and review. It produced no reflection document, no commit, and no card note. iterate printed 'ACT-135 is Done' and exited 0, so an unattended iteration would have recorded a completed reflection that never happened.

Every other column is guarded by an observable outcome: step() compares the card's status before and after, and runCard() additionally compares the card's text to catch a stage that wrote nothing. The Done branch compares nothing. It is the one stage whose output is a document rather than a column move, and it is the only one with no check that the output exists.

Note the asymmetry that makes this costly: reflect is the last step of every iteration, so its silent failure is the one least likely to be noticed and the one that loses the most, since the reflection is where an iteration's lessons are supposed to survive.

The script lives at ~/.scripts/iterate, chezmoi-managed out of ~/code/dotfiles, not in this repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a reflect session that produces no document, no commit and no card note makes iterate step exit non-zero rather than printing '<card> is Done' and exiting 0 (observed 2026-09-09 on ACT-135: a 1-turn reflect session emitting only its rule-file announcement was reported as success)
- [ ] #2 a reflect session that does produce its reflection still exits 0, so the guard does not block the normal path (the reflect stages recorded in backlog/docs as reflection-ACT-*.md are the shape it must accept)
<!-- AC:END -->
