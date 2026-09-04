---
id: ACT-63
title: 'search the target''s project corpus root, not the control repository''s'
status: To Do
assignee: []
created_date: '2026-09-04 17:30'
updated_date: '2026-09-04 17:30'
labels: []
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
