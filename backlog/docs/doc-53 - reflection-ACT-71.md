---
id: doc-53
title: 'reflection: ACT-71'
type: other
created_date: '2026-09-09 01:28'
---

# Reflection, ACT-71

The card is Done with both acceptance criteria checked, unit and integration test
evidence recorded, and milestone m-3 closed to 5/5.

## 1. What is the target condition?

ACT-71 belongs to milestone m-3 ("Tell a real corpus improvement from noise").
The bet is doc-50's queue line 3: "ACT-71 (m-3, Medium): m-3's only open card;
closes that milestone to 5/5."

What it expected to make observable is that when a benchmark stage run fails
judgment or is stopped mid-run, the stage artifact written to disk records the
workflow model, judge model, effort settings (`effort`, `judgeEffort`), and
`sessionBudgetUsd`. Reading the stage artifact alone must answer what model
produced it without consulting the card or commit that launched it, and preserve
the comparability keys required by `comparison-comparability.ts`.

## 2. What is the actual condition now?

Observed at HEAD (commit 39bc14e):

- In `src/benchmark/run-abort.ts`, `PendingStage` captures `model`, `effort`,
  `judgeModel`, `judgeEffort`, and `sessionBudgetUsd`.
- `writeStageJudgeFailure` and `writePendingStage` serialize these fields into the
  stage JSON artifact on disk.
- In `src/benchmark/run.ts:runGradedStages`, `pendingStage` is constructed with
  these configuration parameters from `context`, ensuring they are retained on
  aborted runs, failed stage grades, and validation errors.
- Verified by direct test execution:
  - `src/benchmark/run-abort.test.ts`: `writeStageJudgeFailure > carries the model, judge model, effort settings, and budget into the failed artifact` (AC #1, #2).
  - `src/benchmark/run.test.ts`: `runGradedStages > records workflow model, judge model, effort settings, and budget in the aborted stage artifact when judgment fails` (AC #1, #2).
- Full repo verification:
  - 1,323 tests passed across 85 files.
  - `oxlint --type-aware`: 0 warnings, 0 errors across 225 files.
  - `tsc --noEmit && tsc --noEmit -p client/tsconfig.json`: clean.
  - `oxfmt --check`: clean across 295 files.
- Milestone m-3 is now 5/5 done and completed.

Where the bet and observation differ:
The bet held completely.

## 3. What obstacles stand between here and the goal, and which one is next?

What the run met:
- No obstacles. The fix seam mirrored ACT-70 (commit `fc2e5c4`), and all tests ran
  cleanly on the first implementation turn.

What became possible:
- Aborted and failed run stage artifacts are now self-describing and satisfy the
  comparability prerequisites in `comparison-comparability.ts`, eliminating reliance
  on manual scratch notes.

The next obstacle:
- The active milestones are now m-1 (13/15), m-6 (1/2), and m-7 (0/2).
- The queue from doc-50 points to ACT-50 AC#13 / ACT-126 (m-7, Medium: "Read a
  comparison and decide whether an edit helped") or ACT-51 (m-6: "Watch a run
  spend money while it happens"). In addition, ACT-134 was filed as a follow-up
  from the ACT-130 review.

## 4. What is the next step, and what do you expect from it?

For triage:
Pick line 4 from doc-50 queue: ACT-50 AC#13 / ACT-126 (m-7, Medium: "What moved tab
on comparison screen") or ACT-51 (m-6, High: "Watch a run spend money while it happens"),
or address the symlink follow-up ACT-134.

Expected:
- Advances either milestone m-6 or m-7 toward completion.

## 5. When can the increment be seen?

From outside the session, at HEAD today:
- Inspect any stopped or failed stage artifact (e.g. via `rehearsal show <runId>` or
  directly reading `<runId>.<stage>.json`). The JSON will include `"model"`, `"effort"`,
  `"judgeModel"`, `"judgeEffort"`, and `"sessionBudgetUsd"`.
- Run the test suite:
  ```bash
  mise exec -- bun test src/benchmark/run-abort.test.ts src/benchmark/run.test.ts
  ```
  Both tests pass verifying the preservation of model and effort parameters in the
  aborted stage artifact.

## Verdict

Bet validated. Milestone m-3 closed (5/5).
