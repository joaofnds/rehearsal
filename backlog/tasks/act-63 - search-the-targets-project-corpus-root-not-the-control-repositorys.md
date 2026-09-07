---
id: ACT-63
title: 'search the target''s project corpus root, not the control repository''s'
status: Review
assignee: []
created_date: '2026-09-04 17:30'
updated_date: '2026-09-07 01:22'
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
2026-09-07, code review of commit d6a6662 (the revert to reading A).

All six axes run. Suite: 1063 pass / 0 fail (one flaky rerun on an unrelated
snapshot test, second run clean, not touched by this diff). Typecheck, lint,
format all clean.

Spec, security, refactoring: no blocking findings.

Style and architecture independently found the same defect: currentStageCorpus
called node:os's homedir() directly instead of corpus-file.ts's existing
liveCorpusRoot() (the named seam for exactly this value, already used by
resolveCorpusSource to build the same source this function receives).
Architecture traced this to semantic coupling across three sites (corpus-file.ts,
checkpoint.ts's corpusLayoutRoots, and this call site) with no guard against them
drifting apart, and confirmed via git history that corpus-file.ts is not a stable
target (11 commits in the past year). Fixed in commit 7d51198: currentStageCorpus
now calls liveCorpusRoot(). Full check passes.

Testing found the commit's own stated reason for deleting the pinning test is
factually wrong, verified by reinstating the deleted test against current code:
it does discriminate the two readings (it throws, searching for the discuss
skill under the collapsed duplicate root), contradicting the commit message's
claim that a directory-source test "cannot distinguish" them. The real reason to
distrust that test was different: it depended on the real ~/.claude on whatever
machine ran it. Refactoring independently confirmed the same fact by diffing the
pre-image. This is a documentation-accuracy defect in commit d6a6662's own
message, already on main; noted here rather than rewritten in place.

Testing proposed a hermetic fix: inject HOME so os.homedir() resolves to a
controlled temp directory, record a checkpoint against a distinct target root,
and assert staleness is judged against the injected home. I built this test and
it fails to even reach its assertions: Bun's os.homedir() on macOS ignores
process.env.HOME entirely and reads the system passwd entry regardless (verified
directly: setting HOME before importing node:os and calling homedir() still
returns the real account home). So this specific seam does not exist on this
runtime. Reverted the test attempt; not committed.

Disposition: currentStageCorpus's live branch (the exact behavior this whole
card's back-and-forth was about) remains unpinned by any test, and no cheap
hermetic fix is available given how homedir() behaves on this platform. A real
fix needs an injectable home-resolver threaded into stageCorpusRoots or
currentStageCorpus, a signature change beyond a bug fix's scope. Escalating
this as a follow-up task rather than closing it here, same shape as ACT-92
already split off this card for the replayCorpusRoots gap.

Refactoring also noted (not fixed, cross-file, outside this diff's scope):
RecordedRunsFixture's sourceRoot constructor parameter, added by the build to
let the now-deleted test pass a distinct target root, has no remaining caller
supplying a non-default value anywhere in the codebase. Speculative Generality,
trivial, left for whoever next touches that file.

Post-review correction, 2026-09-06. The Final Summary above is stale on one point: it says staleness-report.ts compares against each run's manifest.sourceRoot. That was reverted at João's direction before the review ran. stale compares against the operator's named corpus, reading A.

The review committed 7d51198, swapping homedir() for liveCorpusRoot() at that call site. That was wrong in a way neither the review nor I caught at first: stageCorpusRoots's parameter is a repository directory that corpusLayoutRoots appends '.claude' to, so passing ~/.claude produced ~/.claude/.claude as the project-level entry. That path cannot exist.

It was never observable. The user-level entry corpusLayoutRoots hardcodes is the one stale wants, and resolution takes the first hit. I confirmed by running 'rehearsal stale' against both versions: byte-identical output. So this was not a live regression, and my first reading of it as one was wrong.

Fixed in the follow-up commit by making the absence explicit: stageCorpusRoots now takes targetRoot as string | undefined and returns [liveCorpusRoot()] alone when there is none. stale passes undefined, which is true of stale. run and replay pass their target and are unchanged. Verified: stale resolves to ['~/.claude'], replay to ['<target>/.claude', '~/.claude'].

On the review's claim that my earlier commit stated a false reason for deleting the test: the review is right that the test can distinguish the two readings, and my stated reason ('a directory-source test cannot distinguish them') was wrong as written. What is true is narrower. The deleted test used a live source, not a directory source, and it depended on the fixture's discuss and build skills resolving out of the real ~/.claude. That is why it could not survive as a hermetic test, and it is why I removed rather than inverted it.

The behavior remains unpinned either way. Both the review and I reached that conclusion independently, and the review additionally showed that injecting HOME does not work, because Bun's homedir() on macOS reads the account record rather than the environment. Closing it needs an injectable home-resolver.

Suite 1063 pass / 0 fail, lint, typecheck and format clean after the follow-up commit. 'rehearsal stale' currently reports nine corpus files changed against the shape checkpoint; that is correct, because ~/code/dotfiles has uncommitted edits to those instruction files applied at 02:48 today, unrelated to this card.

The untested live-corpus branch is split off as ACT-93 at João's direction ('agree'). Nothing else from the review remains open on this card.
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
