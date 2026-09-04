---
id: ACT-70
title: 'a failed stage run records the judge''s findings, not just the grade'
status: Done
assignee: []
created_date: '2026-09-04 23:32'
updated_date: '2026-09-04 23:57'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-13 - reflection-ACT-70.md
type: bug
ordinal: 66008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while shaping ACT-39 on 2026-09-05.

A STAGE_JUDGE_FAILED artifact holds exactly four keys: status, stage, error, and input. The error is one line, 'shape stage graded F; minimum grade is B'. The judge's findings, the per-rubric-item reasoning that produced that grade, are written nowhere.

The cost of this is concrete. Two runs of the audit-log case both graded F. For the first, the defects were reconstructable by reading the shaped card in input.taskState against the product brief: a 201/202 contradiction and two validation rules dropped. For the second run the shaped card is clean, 202 throughout with all three rules stated, and it still graded F. Why is unanswerable from the artifact. That run's 0.53 USD bought a grade and no diagnosis.

This matters more than a normal logging gap because the tool exists to tell an operator whether a corpus edit helped. An edit that moves a grade from F to F, for different reasons, is invisible today. So is an edit that fixes one finding and introduces another.

The input the judge saw is already persisted, so the asymmetry is only on the output side.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A run whose stage fails judgment records the judge's findings text in the run artifact
- [x] #2 The recorded findings name each rubric item the stage failed and why
- [x] #3 Reading a failed run's artifact alone answers 'what did the judge object to' without re-running the stage
- [x] #4 A run whose stage fails judgment (STAGE_JUDGE_FAILED artifact) carries the same hardBlockers/requirements/dimensions/summary fields already present in the mid-run STAGE_JUDGE_FAILED... progress record (StageScorecard's grade), not just a one-line error string
- [x] #5 Each FAIL requirement/hardBlocker and each dimension in the failed artifact names its rubric id and its evidence (source, path, claim), matching what StageJudgeOutput already carries
- [x] #6 Reading only the run's artifact file, with no re-run and no separate progress file, shows which rubric items failed and why
- [x] #7 The JudgeOutputValidationError failure path (malformed/invalid judge output, pending.failure set) is unaffected: it still records prompt/attempts/costUsd and does not need scorecard fields it never had
- [x] #8 Existing tests for run-abort.ts and the STAGE_JUDGE_FAILED shape are updated to assert on the findings fields, not just status/stage/error/input
- [x] #9 A run whose stage fails judgment (STAGE_JUDGE_FAILED artifact) carries the same hardBlockers/requirements/dimensions/summary fields already present in the mid-run progress record (StageScorecard's grade), not just a one-line error string
- [x] #10 Each FAIL requirement/hardBlocker and each dimension in the failed artifact names its rubric id and its evidence (source, path, claim), matching what StageJudgeOutput already carries
- [x] #11 Reading only the run's artifact file, with no re-run and no separate progress file, shows which rubric items failed and why
- [x] #12 The JudgeOutputValidationError failure path (malformed/invalid judge output, pending.failure set) is unaffected: it still records prompt/attempts/costUsd and does not need scorecard fields it never had
- [x] #13 Existing tests for run-abort.ts and the STAGE_JUDGE_FAILED shape are updated to assert on the findings fields, not just status/stage/error/input
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed and committed (fc2e5c4).

Root cause confirmed as shaped: assertStageGradePassed threw before the scorecard's
grade (hardBlockers/requirements/dimensions/summary) reached the pending stage
object, so markAborted's writeStageJudgeFailure rewrote the full StageJudgeRecord
that writeStageProgress had just written down to a four-key status/stage/error/input
summary.

Fix: on a STOP verdict, run.ts now calls context.updatePendingStage with the
scorecard attached, the same seam already used for the JudgeOutputValidationError
path. writeStageJudgeFailure spreads the scorecard's grade fields into the failed
artifact when present.

Verified this session: a new unit test on writeStageJudgeFailure proves the grade
fields land when a scorecard is attached. A new unit test on runGradedStages proves
updatePendingStage is called with the scorecard on a STOP verdict (the risk the
shaping note flagged as unchecked). A new end-to-end test wires the real
createRunAbort through runGradedStages and markAborted with an I/O-backed Fake
persistence, drives a STOP verdict, and reads the resulting artifact back off
'disk' -- confirmed red without the run.ts fix (reverted it, re-ran, watched it
fail) and green with it, so this is a direct observation of the fixed code path
end to end, not just isolated unit coverage. The JudgeOutputValidationError path
is unchanged and its existing tests stayed green throughout.

Full suite (1007 tests), typecheck, lint, and format all pass. No independent
review: change is internal, reversible, touches no trust boundary or untrusted
input, so none of the review triggers apply.

Not run: a live benchmark session against a real case (e.g. audit-log), which
would cost real API budget to observe the same code path this session's
I/O-backed end-to-end test already exercises directly. If you want that
confirmation against a live run, say so and I'll run one.

Nothing left open. Refactor pass found nothing to extract; the diff is a
single-field addition through an existing seam.

Oversight verification, 2026-09-05 (iterate session), independent of the build session's own claims.

The regression test is real. Reverting only src/benchmark/run.ts and run-abort.ts to their pre-fix state, keeping the tests, turns 'keeps the judge's findings in the aborted stage artifact after a normal grade failure' red, and it fails for the right reason: the findings keys are absent from the artifact. Restoring the fix turns it green.

Full checks observed in this session: bun test 1007 pass, 0 fail across 65 files. typecheck clean. lint clean. fmt:check clean.

Not verified here either: a live paid run. The end-to-end test drives the same abort path with real file I/O, so ACT-39's next run will be the first live confirmation.

Live confirmation, 2026-09-05, closing this card's one open item.

The paid audit-log run recorded at .benchmark-runs/2026-09-04T23-53-48.458Z.shape.json failed its shape grade, and the artifact now carries eight keys: status, stage, error, input, hardBlockers, requirements, dimensions, summary. The two prior failed runs carry four.

The findings were readable straight from the artifact with no re-run. They named the single failing hard blocker, invalid-stage-delivery, with its evidence, and showed every other blocker passing. That diagnosis is what re-scoped ACT-64 and produced ACT-72, and none of it was possible from the four-key artifacts.
<!-- SECTION:NOTES:END -->
