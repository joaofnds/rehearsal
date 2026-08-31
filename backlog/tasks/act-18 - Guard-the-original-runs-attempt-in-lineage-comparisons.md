---
id: ACT-18
title: Guard the original run's attempt in lineage comparisons
status: To Do
assignee: []
created_date: '2026-08-31 03:50'
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
- [ ] #1 The per-stage scorecard file records the corpus files, model, and effort the stage session ran with
- [ ] #2 loadAttempts populates lineageInputs for the original run's attempt from that file
- [ ] #3 Presenting the original run beside a replay that ran against an edited corpus is refused, naming the changed file
- [ ] #4 Stage files written before this change still load and present as they do today
<!-- AC:END -->
