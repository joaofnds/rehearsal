---
id: ACT-80
title: >-
  the corpus layout has no rules tree, so cases citing doctrine break after the
  corpus reorganization
status: Done
assignee: []
created_date: '2026-09-05 12:47'
updated_date: '2026-09-05 16:25'
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
- [x] #1 A case can cite a corpus file under the rules tree, not only under skills
- [x] #2 rehearsal stale exits 0 on a corpus where the doctrine moved from a skill to a rules file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed 2026-09-05. The rules tree is now a whole-directory corpus kind beside agents and output-styles, and GLOBAL_SKILLS is empty because the doctrine it named is a rules file the tree now carries.

Two parts, both needed. The corpus reorganization left ~/.agents/rules linked into no harness: .claude symlinks skills and agents but had no rules link, and the same in .claude-livefire and .claude-runsmith. Fixed in dotfiles (6bda704). That alone did not unblock the run, because the harness looks for skills/<name> as a directory and doctrine is now rules/doctrine.md.

Verified: 'rehearsal stale' exits 0 and reports the reorganization correctly against the recorded checkpoints, listing every rules file added and the doctrine skill files removed.

The tests that exercised the global-skill mechanism did so through doctrine as its only member. The mechanism stays wired in run.ts for a future global; the tests that only asserted doctrine's membership are gone, and the one proving a missing skill stops a run before any stage now names a pipeline stage's skill.

2026-09-05, follow-up (91495ba): the dotfiles link that closed this card sat at ~/.claude/rules, a directory Claude Code auto-loads at launch, so every session on the machine started with the whole rules tree in context, about 90k tokens, benchmark sessions included. The tree is now ~/.agents/rulebook, linked into each harness as rulebook (dotfiles b55eaf36), and the corpus kind here follows. stale exits 0 and reports rules/* removed, rulebook/* added, on every recorded checkpoint; full check green.
<!-- SECTION:NOTES:END -->
