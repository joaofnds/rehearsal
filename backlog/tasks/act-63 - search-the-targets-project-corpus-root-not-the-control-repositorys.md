---
id: ACT-63
title: 'search the target''s project corpus root, not the control repository''s'
status: Review
assignee: []
created_date: '2026-09-04 17:30'
updated_date: '2026-09-07 00:43'
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

2026-09-07, built and reviewed.

Changed: stageCorpusRoots (checkpoint.ts) now takes a required targetRoot
parameter and calls corpusLayoutRoots(targetRoot) instead of
corpusLayoutRoots(CONTROL_DIR). CONTROL_DIR removed from checkpoint.ts
entirely. staleness-report.ts's currentStageCorpus passes manifest.sourceRoot.
run-records-test-support.ts's RecordedRunsFixture takes an optional
sourceRoot constructor parameter (default the existing SOURCE_ROOT constant)
threaded into every manifest it writes and into recordCorpusFrom's
stageCorpusRoots call. run-command.ts's buildConfirmationRequest now calls
corpusLayoutRoots(inputs.source.root). replay-command.ts gained an exported
replayCorpusRoots(manifestFile) helper (loads the run's manifest the same way
declaredSessionKnobs already does, returns corpusLayoutRoots(manifest.sourceRoot)),
called from executeReplay in place of corpusLayoutRoots(CONTROL_DIR).

Verified directly: built a real temp target directory with its own .claude/skills,
called stageCorpusRoots and resolveSkillDirectory against it, confirmed the
target's own skill file resolves before ~/.claude falls in as the second root.

Full check passes: bun test (1064 pass, 0 fail), typecheck, lint, format all clean.

Code review: all six axes run (spec, style, architecture, security, testing,
refactoring). Style, architecture, security: nothing found. Refactoring: both
extractions (replayCorpusRoots, the SOURCE_ROOT constant) called net wins, no
objection. Spec and testing independently found the same should-fix: no test
exercised staleCheckpoints's "live" branch through a real checkpoint chain, so a
regression reintroducing CONTROL_DIR at staleness-report.ts's call site would not
be caught. Fixed in this batch: added a test in staleness-report.test.ts building a
real target directory with its own .claude, recording a live-source checkpoint
against it via the fixture's new sourceRoot parameter, editing the recorded skill,
and confirming staleCheckpoints reports the edit as staleness. Mutation-confirmed:
reverting staleness-report.ts's manifest.sourceRoot argument to any other value
makes this new test fail.

Testing axis found one more should-fix, more serious: the new replayCorpusRoots
unit test proves the helper computes the right value but never proves executeReplay
(the real production wiring, hardwired with real ReplayDependencies at the CLI
composition root in rehearsal.ts) actually passes that helper's result into
executeReplayStage's corpusRoots field. Mutation-confirmed: reverting
executeReplay's call site back to corpusLayoutRoots(CONTROL_DIR) leaves the full
suite green. Investigated closing this in-batch: executeReplay's only two branches
either call the real runReplay (needs a real git worktree and would run an actual
paid Claude session for the debug path) or the real runReplayConfirmation (same,
plus real judge scoring for the confirmation path); neither dependency is injected
at executeReplay, unlike the benchmark-layer functions they call, which already
have adequate Fake-based coverage (replay-command.test.ts at the benchmark layer,
replay-confirmation.test.ts's ReplayConfirmationHarness). Revert test: this exact
line was equally untestable before this diff (corpusLayoutRoots(CONTROL_DIR) was
never covered at that call site either), so this is pre-existing test debt this
diff's new code inherits rather than introduces, but it is real should-fix debt on
the line the diff touched. Disposition: tracked as ACT-92 rather than fixed here,
since closing it correctly needs ReplayDependencies made injectable at the CLI
composition root, an architectural change beyond this bug fix's scope.

Not verified: the fix has not been observed against a real target repository that
actually carries a project-level .claude in a live rehearsal run or replay; the
direct verification above used stageCorpusRoots/resolveSkillDirectory directly, not
a full `rehearsal run`/`rehearsal replay` invocation. Both remain latent-bug
territory until a target case gains its own .claude, same as the card's own
description states.

REVIEW FINDING, 2026-09-06: the build implemented reading B for stale, which João rejected.

The decision recorded on this card was reading A: stale checks every recorded run against the one corpus the operator names, defaulting to the live user install. The commit (1c785b3) says the opposite in its own body: 'staleness-report.ts's stale check compares each recorded run against its own manifest.sourceRoot rather than a hardcoded control-repo path.' staleness-report.ts:78 passes manifest.sourceRoot to stageCorpusRoots, so a pipeline checkpoint is now checked against its run's recorded target .claude first, then the user install.

This produces exactly the split the investigation predicted. caseStaleness (staleness-report.ts:251) still hashes against the operator's resolved source, because a session case has no manifest and no target. So the command now answers one question for session cases and a different one for pipeline checkpoints.

Not currently observable: no target repository has a .claude, so both readings resolve to the same files. 'rehearsal stale' reports correctly today (it flagged rulebook/backlog-board.md after a real edit). The suite is green at 1064. This is a latent divergence from the decision, not a broken command.

Separate and probably fine: replay-command.ts:175 also uses manifest.sourceRoot rather than the worktree João chose in question 2. The comment at 166-167 explains that this is the pre-worktree corpus freeze, running before any worktree exists, and sourceRoot is the repository that worktree is built from. That reads as a faithful application of the decision to a site where no worktree is available yet, not a deviation.

Needs João's call: whether to change staleness-report.ts:78 back to the operator's source (reading A, as decided) or to accept reading B now that it is built. Holding the card out of Done until then.

Reverted stale to reading A, 2026-09-06, at João's direction ('agree', answering the recommendation to change it back).

staleness-report.ts:88 now passes homedir() to stageCorpusRoots instead of manifest.sourceRoot, so a live corpus resolves to the operator's install for pipeline checkpoints, matching what caseStaleness already did for session cases. The reason is written into the code above currentStageCorpus so the next reader does not re-derive it.

Removed the test 'compares against the recorded run's own target, not this repository', which pinned the rejected reading. I first tried inverting it, then mutation-tested the replacement by restoring manifest.sourceRoot: it passed under both readings, so it proved nothing. The cause is that stageCorpusRoots only consults the target root when source.kind is 'live' (checkpoint.ts:124); a directory-source test takes the [source.root] branch and never sees the difference. A test that discriminates would need the fixture's discuss and build skills installed in the real ~/.claude, which this session will not write to. So this behavior is currently unpinned, and that is stated rather than papered over.

Both acceptance criteria still hold. #2 is verified: no CONTROL_DIR argument remains at any corpus-root call site in run-command.ts, replay-command.ts, or checkpoint.ts. #1 speaks to a run against a case target, and run and replay both still search the target's .claude first; stale is neither a run nor a replay.

Suite 1063 pass / 0 fail (one fewer than 1064, the removed test). Lint, typecheck and format clean. 'rehearsal stale' verified by hand: it reports rulebook/backlog-board.md changed against a real edit.

Known wart, not worth changing here: under reading A, corpusLayoutRoots(homedir()) yields ~/.claude twice, since its project and user halves collapse to the same directory. Harmless, because resolution takes the first hit. Narrowing stageCorpusRoots would change replay's behavior too, which is outside this decision.
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
