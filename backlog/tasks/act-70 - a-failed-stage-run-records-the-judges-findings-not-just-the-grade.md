---
id: ACT-70
title: 'a failed stage run records the judge''s findings, not just the grade'
status: Build
assignee: []
created_date: '2026-09-04 23:32'
updated_date: '2026-09-04 23:38'
labels: []
dependencies: []
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
- [ ] #1 A run whose stage fails judgment records the judge's findings text in the run artifact
- [ ] #2 The recorded findings name each rubric item the stage failed and why
- [ ] #3 Reading a failed run's artifact alone answers 'what did the judge object to' without re-running the stage
- [ ] #4 A run whose stage fails judgment (STAGE_JUDGE_FAILED artifact) carries the same hardBlockers/requirements/dimensions/summary fields already present in the mid-run STAGE_JUDGE_FAILED... progress record (StageScorecard's grade), not just a one-line error string
- [ ] #5 Each FAIL requirement/hardBlocker and each dimension in the failed artifact names its rubric id and its evidence (source, path, claim), matching what StageJudgeOutput already carries
- [ ] #6 Reading only the run's artifact file, with no re-run and no separate progress file, shows which rubric items failed and why
- [ ] #7 The JudgeOutputValidationError failure path (malformed/invalid judge output, pending.failure set) is unaffected: it still records prompt/attempts/costUsd and does not need scorecard fields it never had
- [ ] #8 Existing tests for run-abort.ts and the STAGE_JUDGE_FAILED shape are updated to assert on the findings fields, not just status/stage/error/input
- [ ] #9 A run whose stage fails judgment (STAGE_JUDGE_FAILED artifact) carries the same hardBlockers/requirements/dimensions/summary fields already present in the mid-run progress record (StageScorecard's grade), not just a one-line error string
- [ ] #10 Each FAIL requirement/hardBlocker and each dimension in the failed artifact names its rubric id and its evidence (source, path, claim), matching what StageJudgeOutput already carries
- [ ] #11 Reading only the run's artifact file, with no re-run and no separate progress file, shows which rubric items failed and why
- [ ] #12 The JudgeOutputValidationError failure path (malformed/invalid judge output, pending.failure set) is unaffected: it still records prompt/attempts/costUsd and does not need scorecard fields it never had
- [ ] #13 Existing tests for run-abort.ts and the STAGE_JUDGE_FAILED shape are updated to assert on the findings fields, not just status/stage/error/input
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause (read this session, not re-verified by a build session yet):

The judge already computes everything the card wants, before the failure path throws it away.

deriveStageGrade in stage-grading.ts produces a StageGrade (extends StageJudgeOutput: hardBlockers, requirements, dimensions each with status/grade + an evidence array of {source, path, claim}, plus summary). This is wrapped into a StageScorecard and, at run.ts around the STOP-verdict branch, written in full to the stage file via context.writeStageProgress(stageRecord) — stageRecord = {...scorecard, corpusFiles, model, judgeModel, judgeEffort, sessionBudgetUsd, effort}.

Immediately after, assertStageGradePassed(scorecard) throws StageQualityError (stage-grading.ts:341), whose message is only the one-liner 'STAGE stage graded F; minimum grade is B'. That propagates to the top-level catch in run.ts (~line 1088), which calls abort.markAborted(message) with just that string. markAborted (run-abort.ts:264) calls writeStageJudgeFailure(pendingStage, reason, ...) (run-abort.ts:90), which overwrites the same stage file with only {status, stage, error, input, ...pending.failure} — pending.failure is only set on JudgeOutputValidationError (malformed judge output), never on a normal STOP-verdict grade. So the full scorecard that was just written to that exact file gets clobbered by a four-key summary.

Fix shape: writeStageJudgeFailure / the PendingStage.failure carried through markAborted needs to include the StageScorecard (or its grade) when the abort reason originates from a StageQualityError, so the final artifact keeps hardBlockers/requirements/dimensions/summary instead of dropping them. StageQualityError already carries the scorecard as a public field (stage-grading.ts:334), so the data is available at the throw site; it just isn't threaded through run.ts's catch into markAborted today.

Not yet checked by this session: whether pendingStage (as tracked by RunAbort) is the same object updated with the scorecard by the time markAborted runs for the STOP-verdict path (unlike the JudgeOutputValidationError path, nothing currently calls context.updatePendingStage with the scorecard on a STOP verdict) — a build session should verify this with a test that drives a STOP-verdict grade through the real abort path, not just unit-test writeStageJudgeFailure in isolation.

Oversight probe, 2026-09-05. Shaping's diagnosis is confirmed by reading the code, and its one open item is answered: yes, the scorecard is in hand at the point the abort path needs it.

The clobber is exact. src/benchmark/run.ts:701 registers the pending stage as { file, stage, input }, with no failure field. Line 738 writes the full StageJudgeRecord, scorecard included, to that same stageFile. Line 761 assertStageGradePassed throws. run-abort.ts:272 then rewrites stageFile from the pending stage, which still has no failure, so writeStageJudgeFailure (run-abort.ts:90-106) emits status, stage, error, input and nothing else. The good record is overwritten by the worse one.

The asymmetry is visible at run.ts:713-723: the JudgeOutputValidationError catch calls updatePendingStage with a failure payload, so the malformed-output path does survive. The ordinary grade failure never calls updatePendingStage at all.

scorecard is a local in scope at the assertStageGradePassed call, so carrying it into the pending stage before the throw needs no plumbing.
<!-- SECTION:NOTES:END -->
