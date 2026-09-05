---
id: ACT-80
title: >-
  the corpus layout has no rules tree, so cases citing doctrine break after the
  corpus reorganization
status: To Do
assignee: []
created_date: '2026-09-05 12:47'
updated_date: '2026-09-05 13:17'
labels: []
dependencies: []
type: bug
ordinal: 76008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The corpus layout accepts CLAUDE.md, output-styles/, agents/ and skills/ (corpus-file.ts:55), and the corpus roots are `.claude` alone (checkpoint.ts:109). The rules tree at `~/.agents/rules` is outside both.

`~/.claude/skills` is a symlink to `~/.agents/skills`, so skills resolve. There is no matching link for rules.

GLOBAL_SKILLS is hardcoded to ["doctrine"] (checkpoint.ts:169) and every stage's corpus hashes it. The 2026-09-05 corpus reorganization deleted that skill and made it `rules/doctrine.md`, so `rehearsal stale` exits 1 and every run refuses at the baseline check.

The suite test 'refuses rehearsal stale with no argument' fails on a clean checkout, so it is environmental rather than a regression here.

Open: whether a global corpus item should be able to name a rules file, or whether `~/.claude/rules` should be symlinked the way skills are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A case can cite a corpus file under the rules tree, not only under skills
- [ ] #2 rehearsal stale exits 0 on a corpus where the doctrine moved from a skill to a rules file
<!-- AC:END -->
