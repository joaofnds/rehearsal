---
id: ACT-18
title: Guard the original run's attempt in lineage comparisons
status: Build
assignee: []
created_date: '2026-08-31 03:50'
updated_date: '2026-08-31 04:53'
labels: []
dependencies: []
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
- [ ] #1 After a CONTINUE grade, reading the per-stage scorecard file shows corpusFiles, model, and effort equal to the inputs used by that stage session.
- [ ] #2 After a STOP grade is calibrated, reading the per-stage scorecard file shows the calibration and preserves that stage session's corpusFiles, model, and effort.
- [ ] #3 Loading a current-format stage scorecard file produces an original-run Attempt whose lineageInputs equal the file's corpusFiles, model, and effort.
- [ ] #4 Loading a pre-change stage scorecard file still produces and presents the original-run Attempt without lineageInputs, including beside a replay.
- [ ] #5 Loading and presenting an original run beside a replay whose corpus changed refuses the comparison and names the changed corpus file.
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
