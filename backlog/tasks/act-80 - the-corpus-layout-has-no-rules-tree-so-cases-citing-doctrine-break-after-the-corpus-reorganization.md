---
id: ACT-80
title: >-
  the corpus layout has no rules tree, so cases citing doctrine break after the
  corpus reorganization
status: To Do
assignee: []
created_date: '2026-09-05 12:47'
updated_date: '2026-09-05 12:47'
labels: []
dependencies: []
type: bug
ordinal: 76008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The corpus layout accepts CLAUDE.md, output-styles/, agents/ and skills/ (corpus-file.ts:55). It has no path for the rules tree. João's corpus reorganized on 2026-09-05, moving doctrine, board, ownership, refactor, style and testing out of ~/.claude/skills/ and into ~/.agents/rules/. Cases that cite those as skills now name files that do not exist.

Observed 2026-09-05: 'rehearsal stale' prints 'The doctrine skill is not installed; searched .../.claude, /Users/joaofnds/.claude' and exits 1. The suite test 'refuses rehearsal stale with no argument, exactly as declared' fails on the exit code, and it fails on a clean checkout, so it is environmental rather than a regression in this repo's code.

This is not a defect in the harness's logic. The corpus moved and the layout did not follow. Deciding what a rules file is to a case, and whether stale should treat a missing skill as fatal when the corpus has reorganized, is the work.

Found while fixing the untracked-board failure; recorded rather than folded into that change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A case can cite a corpus file under the rules tree, not only under skills
- [ ] #2 rehearsal stale exits 0 on a corpus where the doctrine moved from a skill to a rules file
<!-- AC:END -->
