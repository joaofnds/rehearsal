---
id: ACT-115
title: re-land the --append-notes line on main in the shape and build skills
status: To Do
assignee: []
created_date: '2026-09-08 10:38'
updated_date: '2026-09-08 10:38'
labels: []
dependencies: []
priority: medium
ordinal: 111008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The prose fix telling a session to write a card's record with `backlog task edit --append-notes` rather than `--notes` (which replaces the field) was written once, as dotfiles commit e33c7abf on 2026-09-06, but that commit sits on a session checkpoint ref and never reached main. Verified 2026-09-08: e33c7abf is absent from `git rev-list main`, no ref contains it, and `git log -S append-notes` over dot_agents/skills/shape/SKILL.md and dot_agents/skills/build/SKILL.md finds no commit touching the string. No rendered skill under ~/.agents/skills names the flag today.

The content to re-land is in e33c7abf itself: it added the line to both skills at the point each tells a session to write the card's record. Recover it with `git show e33c7abf` in ~/code/dotfiles while the object is still reachable; it is unreferenced and a gc would drop it.

This is an ordinary edit to the chezmoi source on main. An earlier note on ACT-86 claimed a revert swept the fix away and proposed an isolated commit to defend against a repeat; that diagnosis was false, so no such guard is needed.

The edit is to files agents load as instructions, so it goes through the review-instructions skill in the same turn as the draft.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both ~/.agents/skills/shape/SKILL.md and ~/.agents/skills/build/SKILL.md name --append-notes where each tells a session to write the card's record
- [ ] #2 The change is committed on main in ~/code/dotfiles and reachable from it, shown by git log -S append-notes finding the commit on the branch
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Exact content recovered from e33c7abf 2026-09-08, in case the object is gc'd before this card runs. The same two lines were appended to both skills:

    Add it with `backlog task edit <id> --append-notes`, which keeps what an earlier
    session recorded there. Every other value flag on that command overwrites its field.

Each was placed as a new paragraph directly after the instruction to write the card's record. Confirm placement against the current file when re-landing; the surrounding prose may have moved since.
<!-- SECTION:NOTES:END -->
