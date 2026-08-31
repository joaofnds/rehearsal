---
id: ACT-18
title: Guard the original run's attempt in lineage comparisons
status: Done
assignee:
  - '@claude'
created_date: '2026-08-31 03:50'
updated_date: '2026-08-31 05:10'
labels: []
dependencies: []
modified_files:
  - src/benchmark/run.ts
  - src/benchmark/attempts.ts
  - run-benchmark.test.ts
ordinal: 10008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-4 added a comparison guard in src/benchmark/attempts.ts (presentAttempts / assertComparableLineages) that refuses to present attempts which ran against different corpora, models, or efforts. It reads those inputs from Attempt.lineageInputs, which loadAttempts populates from each replay record.

The original run's attempt is exempt: loadOriginalAttempt reads the per-stage scorecard file (<run>.<stage>.json) written in src/benchmark/run.ts runGradedStages, and that file holds the scorecard only. The corpus files, model, and effort the stage session actually ran with are captured in the same loop (the corpusFiles from executeStageSession) but written only into the checkpoint record, never into the stage file.

Consequence: the most common comparison a user makes, the original run against a replay of it, is the one the guard cannot check. A replay run after a corpus edit is presented beside the original with no refusal, exactly the mismatch the guard exists to catch.

Fix: carry the session's corpusFiles, model, and effort into the stage scorecard file alongside the scorecard, and populate Attempt.lineageInputs from them in loadOriginalAttempt. Keep the fields optional in the parsing schema so stage files written before this change still load and present as they do today (attempts without lineage inputs are skipped by the guard, which is the existing intended behavior for old records).

Verify with a loadAttempts test asserting the original attempt carries its inputs, and a presentAttempts test showing an original-versus-replay mismatch is refused.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a CONTINUE grade, reading the per-stage scorecard file shows corpusFiles, model, and effort equal to the inputs used by that stage session.
- [x] #2 After a STOP grade is calibrated, reading the per-stage scorecard file shows the calibration and preserves that stage session's corpusFiles, model, and effort.
- [x] #3 Loading a current-format stage scorecard file produces an original-run Attempt whose lineageInputs equal the file's corpusFiles, model, and effort.
- [x] #4 Loading a pre-change stage scorecard file still produces and presents the original-run Attempt without lineageInputs, including beside a replay.
- [x] #5 Loading and presenting an original run beside a replay whose corpus changed refuses the comparison and names the changed corpus file.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: guard original-versus-replay comparisons with the inputs the original stage session actually consumed, while preserving old run artifacts.

What exists (read 2026-08-31):
- runGradedStages receives corpusFiles from executeStageSession and the workflow model/effort from StageContext, but writes only StageScorecard to <run>.<stage>.json.
- loadOriginalAttempt parses that file with a loose local zod schema and creates no lineageInputs; replay attempts already carry the same inputs from ReplayRecord.
- presentAttempts already refuses labelled attempts whose corpus, model, or effort differ and skips attempts with no lineageInputs. No comparison algorithm change is needed.

Unknowns resolved from repository conventions:
1. Persist corpusFiles, model, and effort as top-level fields beside the existing scorecard fields. This preserves the stage file's current scorecard shape instead of introducing a nested envelope.
2. Record the workflow stage settings (context.model and context.effort), not the Judge settings. Those are the settings that produced the attempted artifact and match ReplayRecord lineage inputs.
3. Treat corpusFiles and model as the minimum complete lineage metadata. loadOriginalAttempt creates lineageInputs only when both are present; absent effort means no effort. A partial legacy record remains presentable without a guard rather than inventing inputs.
4. Build one graded stage record and reuse it for the normal write and the calibrated STOP rewrite so calibration cannot discard lineage metadata. The pending Judge marker remains unchanged because it is not an attempt.
5. Parse all three new fields as optional, using hashedFileSchema and effortSchema, so pre-change scorecard files retain their existing load-and-present behavior.

Acceptance observations are the structured criteria above.

First test to write: runGradedStages writes the captured corpus hash plus context model and high effort into the stage file after a CONTINUE grade; observe it fail because those fields are absent today.

Glossary: added Stage scorecard.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Handoff

Changed:
- Stage scorecard files now retain the stage session corpusFiles, workflow model, and effort after CONTINUE grades and calibrated STOP grades.
- loadAttempts validates current stage-file lineage metadata and attaches it to the original Attempt when corpusFiles and model are present.
- Legacy or partial stage files remain loadable without lineageInputs, preserving their unguarded presentation behavior.
- Original-versus-replay comparisons now use the existing lineage guard and name changed corpus files.

Available but not wired / old path:
- No callers remain to wire; every loadAttempts caller receives current original lineage automatically.
- Pre-change stage files intentionally remain on the legacy unguarded path because they do not contain enough information for a comparison.

Observed:
- bun test: 221 pass, 0 fail, 399 expectations.
- bun run lint, bun run typecheck, and bun run fmt:check completed successfully.
- A direct temporary-artifact invocation of loadAttempts loaded lineage for the original and replay, then presentAttempts raised LineageMismatchError naming skills/discuss/SKILL.md.

Not verified:
- No paid end-to-end benchmark session was run; the stage-session persistence path was observed through the runGradedStages harness tests.

Stopped defects:
- Type-aware lint rejected awaiting Bun's void-typed rejection matcher; commit 3ff6b12 now settles the rejected stage promise separately before reading the record.

Review and refactor:
- Independent review examined all changed files across style, architecture, spec, security, testing, and refactoring; no findings.
- The refactor pass found no structural change that would reduce complexity without coupling the trusted writer to its optional disk-read boundary.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Original stage attempts now carry their actual corpus, workflow model, and effort into lineage comparisons. Verified current and legacy stage-file behavior, calibrated STOP preservation, and refusal of an original/replay corpus mismatch naming the changed skill file; all 221 tests and project checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
