---
id: ACT-63
title: 'search the target''s project corpus root, not the control repository''s'
status: To Do
assignee: []
created_date: '2026-09-04 17:30'
updated_date: '2026-09-06 23:19'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 60008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
stageCorpusRoots (src/benchmark/checkpoint.ts:120) resolves a live corpus to corpusLayoutRoots(CONTROL_DIR), which searches the control repository's .claude before the user's. run-command.ts:283 and replay-command.ts:245 pass CONTROL_DIR the same way.

This is the same conflation ACT-41 fixed one layer down: the project-level corpus root a stage session should search is the target's, not the harness's. A run against a case target whose repository carries its own .claude/skills gets the harness's project corpus instead, or falls through to the user level and silently ignores the target's.

Latent today, not active: /Users/joaofnds/code/rehearsal/.claude does not exist (observed 2026-09-04), so every search currently falls through to ~/.claude and lands on the right files. It becomes a live defect the moment either repository gains a project-level corpus directory.

Exposed by ACT-41, which removed the same control-root assumption from the instruction file. Deciding which root a stage's corpus searches is a design question about whether a target's project-level corpus is part of what a case measures, so it is shaped rather than fixed in passing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stage's corpus roots for a run against a case target search that target's .claude before the user's, and never the control repository's
- [ ] #2 corpusLayoutRoots is called with the target root at every run and replay site, with no CONTROL_DIR argument remaining
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-06, premises rechecked before shaping. All still hold, with refreshed line numbers.

Latent, not active: neither /Users/joaofnds/code/rehearsal/.claude nor /Users/joaofnds/code/nest/template/.claude exists today, so every live-corpus search falls through to ~/.claude and lands on the right files.

The defect stands. checkpoint.ts:120-123 still resolves a live corpus to corpusLayoutRoots(CONTROL_DIR). The CLI sites moved: run-command.ts:294 and replay-command.ts:293 (the card says 283 and 245).

Worth carrying into the shaping: run.ts:671 already does corpusLayoutRoots(context.targetDir), and replay.ts:390 and 434 use corpusLayoutRoots(worktreeDir). So the correct form is already the majority in the benchmark layer, and CONTROL_DIR survives only at the two CLI entry points and in stageCorpusRoots. That narrows the design question to whether stageCorpusRoots should take a target root as an argument rather than reaching for a module constant.
<!-- SECTION:NOTES:END -->
