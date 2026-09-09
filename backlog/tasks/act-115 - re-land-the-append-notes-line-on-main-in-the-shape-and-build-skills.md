---
id: ACT-115
title: re-land the --append-notes line on main in the shape and build skills
status: To Do
assignee: []
created_date: '2026-09-08 10:38'
updated_date: '2026-09-09 16:21'
labels: []
dependencies: []
priority: medium
ordinal: 111008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Land the recorded --append-notes guidance in dotfiles main and rendered shape/build skills; the old checkpoint ref no longer exists.
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

Cross-board wait: implementation belongs to /Users/joaofnds/code/dotfiles. Reconsider when an owning-session result is available or that repository is explicitly in scope. This triage makes no reciprocal board edits.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: medium. The approved lines are absent from dotfiles main and rendered skills, blocking ACT-86.

Evidence: e33c7abf exists as an object but no branch/ref contains it; dotfiles main/HEAD 34bf9ebf has no append-notes line.

Unresolved claims/resources: external dotfiles ownership; review-instructions workflow Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal.

Next action: Apply the recorded text to dotfiles main, commit, render and verify both installed skills.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
