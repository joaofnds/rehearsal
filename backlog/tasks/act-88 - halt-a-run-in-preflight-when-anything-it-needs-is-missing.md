---
id: ACT-88
title: halt a run in preflight when anything it needs is missing
status: Done
assignee: []
created_date: '2026-09-05 23:59'
updated_date: '2026-09-07 18:09'
labels: []
dependencies: []
ordinal: 84008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running a case whose declared target directory is absent halts before the first stage, naming the missing path
- [x] #2 Running a case whose declared task, product brief, rubric, or pipeline file is absent halts before the first stage, naming the missing file
- [x] #3 Running a case halts before the first stage when the requested model is unavailable
- [x] #4 Running a case halts before the first stage when the declared session budget is absent or not a positive amount
- [x] #5 Every preflight failure names what is missing and what would fix it, and no stage runs after one
- [x] #6 A run whose every declared reference resolves proceeds unchanged
- [x] #7 Replay and calibrate halt before spending anything when the model they would run under is unavailable, the same as run
- [x] #8 The model check reads the CLI result envelope rather than the process exit code, which is 0 on an unrecognized model
- [x] #9 A pipeline case whose declared settingsFile is absent halts before the first stage on a plain run, not only under --confirm or replay
- [x] #10 A session case whose declared fixture, transcript prefix, or corpus file is absent halts before the session starts, naming the missing path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
One gate function, called at the top of run, replay, and calibrate before any
stage or provider call, that walks every reference the loaded case (or, for
calibrate, the frozen record) declares and throws RefusedPreconditionError
(src/benchmark/exit-codes.ts) naming the first missing or invalid one and what
fixes it. Fail-fast on the first failure, not a collector.

Order of checks inside the gate: target readiness, then declared file reads
(task, product brief, final rubric, pipeline, per-stage rubrics), then budget
(already enforced by existing parses, so mostly a call-order guarantee), then
the model probe last, since it is the only one that costs anything (a
throwaway provider call).

Call sites: runRunCommand before dependencies.execute (run-command.ts:141),
runReplayCommand before dependencies.execute (replay-command.ts:136),
runCalibrate before buildJudges is invoked (calibrate-command.ts, right after
judgeKnobsOf(record) is computed since calibrate always runs under the frozen
judgeModel and takes no --model/--judge-model override).

New code: probeModelAvailable(model) runs `claude --model <model> -p 'hi'
--output-format json`, reads the result through readClaudeEnvelope
(src/benchmark/claude.ts:68), which already throws on is_error true using
envelope.result as the message — confirmed this session that the process exit
code is 0 on an unrecognized model, so the gate must read the envelope, never
the exit status.

Everything else the gate calls already exists (assertSourceReady, the file
reads in loadPipelineCase/loadStageRubric, parseSessionKnobs's budget check,
judgesFor's budget check for calibrate); the work is relocating the call ahead
of the first stage, and, for the file-read failures, wrapping the raw ENOENT
in a message that names the missing file and the fix, since AC #2 and AC #5
ask for that framing and today's failure is a bare filesystem error.

AC #6 (a fully-resolvable case proceeds unchanged) is the regression backstop:
every existing passing run/replay/calibrate test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reviewed by review-code (commit 1a6af30), 2026-09-07. Six reviewers, one per
axis: spec, style, architecture, security, testing, refactoring (advisory).
Suite green before and after (1112+62 tests), typecheck/lint/fmt clean.

Findings and disposition:
- [Spec, should-fix] AC #9's plain-run wiring (settingsFilePath reaching the
  real assertPipelinePreflight) had no test above the unit level; every
  run-command test stubbed assertPreflight as a no-op. Fixed: added a test
  in run-command.test.ts asserting the real call args (sourceDir,
  settingsFilePath, model) runRunCommand passes to assertPreflight.
  Mutation-verified by swapping the settingsFilePath source to a literal.
- [Style, should-fix] preflight.ts's doc comment on asTargetPrecondition
  claimed a missing target directory's ENOENT propagates unconverted,
  distinct from the four named precondition messages. Verified directly
  (bun -e against realpath's ENOENT, plus an end-to-end run against a
  nonexistent target) that it is in fact converted, same as the other four
  -- Node's fs ENOENT is a plain Error, indistinguishable under isBareError.
  Fixed: corrected the comment.
- [Refactoring, should-fix, advisory] RunCommandDependencies.assertPreflight
  used Parameters<typeof assertPipelinePreflight>[0] instead of importing
  the purpose-built PipelinePreflightInputs interface preflight.ts already
  exports for the identical shape -- a one-off type-level pattern nowhere
  else in the codebase. Fixed: switched to the named type.
- [Style, note] Duplicated catch/rewrap shape across three functions in
  preflight.ts (asRefusedPrecondition, probeModelAvailable, asTargetPrecondition).
  Not fixed: merging would trade three self-documenting call sites for one
  generic helper taking two closures, a plausible net loss on reveals-intent;
  left as observed, not actioned.
- [Style, note] assertPipelinePreflight's four sequential independent-effect
  statements have no blank-line separation. Borderline under the house
  blank-line rule; not fixed, reviewer flagged it as a note not a should-fix.
- [Refactoring, note] The card's Implementation Plan narrates "target
  readiness, then declared file reads" as the order, but the actual wired
  call sequence in run-command.ts checks declared files (via requireCase)
  before target readiness (via assertPreflight). No AC requires this
  ordering; recorded here since the plan's prose doesn't match the code.
- Architecture, Security, Testing: nothing found. Architecture reviewer
  independently confirmed the ACT-106 deferral (assertControlReady/
  assertSourceReady running twice/three times) is correctly scoped and
  non-blocking. Testing reviewer independently mutation-tested the
  isBareError guards and confirmed the ordering guarantees the spec
  reviewer traced.

Fixed in commit 166f120. Full suite (bun run test) green, 1112+62 tests;
typecheck/lint/fmt clean. Nothing outstanding from this review.
<!-- SECTION:NOTES:END -->
