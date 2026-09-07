---
id: ACT-63
title: 'search the target''s project corpus root, not the control repository''s'
status: Done
assignee: []
created_date: '2026-09-04 17:30'
updated_date: '2026-09-07 01:29'
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
- [x] #1 A stage's corpus roots for a run against a case target search that target's .claude before the user's, and never the control repository's
- [x] #2 corpusLayoutRoots is called with the target root at every run and replay site, with no CONTROL_DIR argument remaining
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-07, code review of the delta since commit 7d51198 (this review's own prior fix), covering c6c4d14 and the board-record commits da3b433/4a9b497/45f3705.

All five applicable axes ran (testing skipped: no test file in this delta). Suite:
1063 pass / 0 fail, typecheck/lint/format clean.

Spec confirmed the fix in c6c4d14 correct (verified stageCorpusRoots(source,
undefined) resolved to a real path, not the ~/.claude/.claude dead path 7d51198
produced) and both acceptance criteria still met. Security: nothing found, no
untrusted input reaches the changed parameter. Style: nothing found.

Architecture and refactoring independently converged on the same defect:
stageCorpusRoots's new optional targetRoot gave it two purposes selected by a
caller-chosen sentinel (undefined for stale's "no target" case, a real string
for every other caller's "resolve against my target" case), and the undefined
branch's [liveCorpusRoot()] duplicated corpusLayoutRoots's own inlined
join(homedir(), ".claude") a few lines above as a second, unlinked expression
of the same fact.

Fixed in commit f1d8314: stageCorpusRoots reverted to requiring a real
targetRoot, single-purpose. corpusLayoutRoots now calls liveCorpusRoot()
instead of re-deriving the same path inline, closing the duplication.
staleness-report.ts's currentStageCorpus no longer calls stageCorpusRoots at
all; it states [source.root] directly, since a live CorpusRoot's own root
field is already liveCorpusRoot(). Verified 'rehearsal stale' output
unchanged. Full check passes after the fix: 1063 pass / 0 fail, typecheck,
lint, format clean.

Both should-fix findings closed. Nothing else from this round is open. ACT-93
(the untested live-corpus branch, independently reconfirmed by spec and
refactoring this round) remains open as its own card, unaffected by this fix.

Second review round, 2026-09-06. Two axes independently found that my sentinel design gave stageCorpusRoots two purposes selected by an undefined argument, and duplicated a path expression. Fixed in f1d8314 by reverting stageCorpusRoots to single-purpose and letting stale build [source.root] directly.

Verified independently: a live source already carries root '/Users/joaofnds/.claude', so [source.root] resolves to exactly what stale wants, with no target root and no sentinel. That is simpler than my version and reaches the same place. Confirmed by resolving the live source and by running the command.

Suite 1063 pass / 0 fail, lint, typecheck, format clean. Both acceptance criteria hold: no CONTROL_DIR remains at any corpus-root call site, and run and replay still search the target's .claude first.

Note on the stale output while reading this card: it lists twelve corpus files changed against the shape checkpoint, up from nine earlier in the session. That is correct and unrelated to the code. ~/code/dotfiles has uncommitted instruction-file edits being made during this session.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
stageCorpusRoots and both CLI call sites (run-command.ts, replay-command.ts)
now search the target repository's own .claude before the user's, never
CONTROL_DIR. staleness-report.ts's live-corpus check now compares against
each recorded run's own manifest.sourceRoot. Both acceptance criteria met and
tested. Full check passes: 1064 tests, typecheck, lint, format all clean.

Code review (6 axes) found two should-fix coverage gaps beyond the fix itself,
both on test coverage rather than the production behavior: staleness-report.ts's
live branch (fixed in this batch, mutation-confirmed) and executeReplay's real
production wiring of corpusRoots, which needs an architectural change
(injectable ReplayDependencies) to close and is tracked as ACT-92.
<!-- SECTION:FINAL_SUMMARY:END -->
