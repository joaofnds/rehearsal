---
id: ACT-63
title: 'search the target''s project corpus root, not the control repository''s'
status: Build
assignee:
  - '@claude'
created_date: '2026-09-04 17:30'
updated_date: '2026-09-06 23:59'
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

2026-09-07, shaped.

Goal: stageCorpusRoots and its two CLI callers search the target repository's
.claude before the user's, never the control repository's.

Design (only one way to build it, no survey needed): give stageCorpusRoots a
required targetRoot parameter and call corpusLayoutRoots(targetRoot) instead of
corpusLayoutRoots(CONTROL_DIR). Remove CONTROL_DIR entirely from checkpoint.ts,
run-command.ts, and replay-command.ts. Each of the four call sites already has
a target root in scope, so this is wiring, not new plumbing:
- checkpoint.ts:120 stageCorpusRoots itself takes the parameter.
- staleness-report.ts:78 (stale) passes manifest.sourceRoot, the target's
  original path the manifest already records (target.ts:74); the worktree
  itself is gone by then (removeWorktree, replay.ts:495), so sourceRoot is the
  only live-corpus root available for a finished run.
- run-records-test-support.ts:312 (test support for stale) takes the same
  target root its caller already threads through for the run/replay it built.
- run-command.ts:294 passes inputs.source.root (SourceBaseline.root,
  target.ts:12), already present in ConfirmationRequestInputs.
- replay-command.ts:293 needs manifest.sourceRoot; executeReplay does not load
  the manifest today, but declaredSessionKnobs in the same file (line 147)
  already does via loadRunManifest(paths.manifestFile) for model/effort, so
  executeReplay loads it the same way.

No design question goes to him: run.ts:671 and replay.ts:390/434 already call
corpusLayoutRoots with the correct target root, so this change makes the two
CLI sites and stageCorpusRoots consistent with the majority form already in
the benchmark layer, not a new pattern.

First test to write: checkpoint.test.ts:829-840 (stageCorpusRoots describe
block) currently asserts corpusLayoutRoots(CONTROL_DIR) for the "live" case;
change it to assert corpusLayoutRoots(<a fixture target root>) for a
targetRoot argument the test passes in, and confirm it fails against today's
code before fixing.

Acceptance criteria unchanged from the card; both are still correct as stated.

João's decision 2026-09-06 on the replay corpus root: the worktree directory, matching replay.ts:390 and 434. Quoted: 'sure', answering the recommendation to match what the benchmark layer already does. So replay-command.ts:293 takes the worktree root, not manifest.sourceRoot and not CONTROL_DIR.

Still open: what stale's live-corpus check should mean. João: 'I think we need to investigate more and weight the differences, pros and cons, and the we would be letting go with each choice.' Investigation in progress this session.

Investigation of question 1 (what stale's live-corpus check means), 2026-09-06.

THE TWO READINGS
A. Live-machine: check every recorded run against the one corpus the operator names, defaulting to what is installed now. This is today's behavior.
B. Per-run: check each recorded run against the target root recorded in its own manifest.

WHAT DECIDES IT

1. Session cases cannot do B. stale covers two kinds: pipeline checkpoints (staleCheckpoints) and session cases (staleCases, staleness-report.ts:283). A session case has no manifest, no sourceRoot, and no target concept at all (loadSessionCase in case.ts builds no target field). Under B, half the command keeps A's meaning and the other half changes. That is not a design choice between two coherent options; B is only definable for pipeline runs.

2. The command's own interface says A. 'rehearsal stale --help': 'List the checkpoints and session cases a corpus edit invalidated', with --corpus 'Corpus under test: a directory in corpus layout (default the live install)'. One corpus per invocation, one edit. Under B, --corpus becomes meaningless for pipeline runs, since each run would bring its own root.

3. There is a real precedent for B in the same command, and it is narrower than it looks. --model and --effort default to 'the model each run recorded, asserting nothing'. So per-run defaults exist here. But those are properties of the run being compared, not of the thing the operator edited. The corpus is what the operator edited. That asymmetry is the actual distinction between the two flags and the corpus.

WHAT EACH GIVES UP

Choosing A gives up: a run recorded against a target that carried its own project-level corpus is checked against whatever is live now, so an edit to that target's own .claude would not be seen. Today this costs nothing, because no target has a project-level corpus. It becomes real the day one does.

Choosing B gives up: one command answering one question. The operator edits a file and asks what it invalidated; under B the answer depends on where each run's target happened to sit, and a moved or deleted target root makes runs unanswerable rather than stale. It also gives up --corpus having any meaning for pipeline runs, and it leaves session cases on A regardless.

RECOMMENDATION
A, today's behavior, with the CONTROL_DIR bug fixed so 'live' means the user install rather than the harness repository. B is not a symmetric alternative; it is undefined for half the command's subjects and it removes the flag the command documents as its main input. If a target's own project corpus later needs to participate, that is a separate capability (a per-run corpus source stale can be pointed at) rather than a redefinition of the default.

This leaves criterion #1 as written ('never the control repository's') satisfied by fixing stageCorpusRoots to take a root argument, with stale passing the operator's resolved source as it does now.

João's decision 2026-09-06 on question 1, after reading the investigation: keep today's behavior (reading A) and fix the bug under it, so 'live' means the user install rather than the harness repository. Quoted: 'go', answering that recommendation.

Both design questions are now settled:
1. stale checks every recorded run against the one corpus the operator names, defaulting to the live user install. --corpus keeps its documented meaning. stageCorpusRoots stops reaching for CONTROL_DIR and takes a root argument instead, with stale passing the source it already resolves.
2. A replay's corpus search uses the worktree directory, matching replay.ts:390 and 434.

No open questions remain. The shaping can proceed on these two answers.
<!-- SECTION:NOTES:END -->
