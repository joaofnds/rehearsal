---
id: ACT-17
title: Show the delivery judge the commit history
status: Build
assignee: []
created_date: '2026-08-31 02:05'
updated_date: '2026-08-31 05:25'
labels: []
dependencies: []
ordinal: 9008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The build-stage Judge grades delivery-discipline (incremental, test-first commit sequence) but its input carries only the flattened baseline..result diff. Run 2026-08-31T01-45-19 delivered five clean conventional commits and was graded C for lacking visible incremental history. Add the stage's commit subjects (git log baseline..result) to StageJudgeInput for stages that commit, citable as its own source, and name it in the stage judge prompt.

## Goal

Give every stage Judge frozen, citable evidence of the commits made by exactly that stage, so commit-sequence rubric dimensions grade the delivery rather than the flattened diff.

## Shaping Notes

### Evidence read

- `executeStageSession` builds Judge input for both forward runs and replay; its `baselineSha` advances after each accepted stage.
- Planning stages may commit workflow artifacts and already return their validated `resultSha`, diff, and changed paths.
- Delivery validation already reads `git log --format=%s baseline..result`, but only when a pipeline configures a subject convention and only to validate it.
- `StageScorecard` embeds `StageJudgeInput`, so preliminary, completed, replayed, and calibration records preserve any field added to that input.

### Unknowns and resolutions

1. Which stages receive history? Any stage whose validated result advances its baseline, independent of stage kind. A planning stage may commit; a stage that does not commit omits the optional field.
2. Which commits and in what order? Exactly `baselineSha..resultSha`, oldest first. This excludes setup and prior-stage commits and presents the sequence in the order work advanced.
3. When is history trusted? Only after the result is validated as a descendant of the stage baseline. Invalid delivery keeps the existing fallback input with `harnessFailure` and no commit history.
4. What is recorded? Subjects only, as optional `commitSubjects`; no hashes, bodies, timestamps, or patches. Capture is unconditional and does not depend on `commitSubjectPattern`; when that pattern exists, validate the same captured subjects.
5. How is it cited? Add `commit-subjects` as a whole-source evidence source. The validator accepts that source spelling and the input field spelling `commitSubjects`; the Judge prompt names both the source and its citation path.
6. Does replay differ? No. Replay uses `executeStageSession` against a detached worktree and must produce the same stage-local evidence contract.
7. What about old artifacts? Existing readers are loose and the field is optional, so no compatibility adapter or migration is needed.

### Glossary

Added **Stage commit history**: oldest-first subjects of commits a stage added after its baseline, absent when the stage did not advance target history.

### First Test To Write

In the real-git `assertBuildCommitted` test group, create two commits after the captured baseline and assert that the returned commit subjects are both present oldest first even without a configured `commitSubjectPattern`; this fails today because the result exposes no subjects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stage that adds two descendant commits gives its Judge exactly those two subjects oldest first; commits at or before the stage baseline are absent, even when no commit-subject convention is configured
- [ ] #2 A committing planning stage gives its Judge its own stage commit history, and the following stage receives only commits made after the planning stage advanced the baseline
- [ ] #3 A planning stage that creates no commit omits commitSubjects from its Judge input
- [ ] #4 A replayed stage records the same stage-local commit subjects from its detached baseline as a forward run
- [ ] #5 A stage result that fails ancestry or delivery validation gives the Judge harnessFailure and no unvalidated commitSubjects
- [ ] #6 The stage Judge prompt identifies commitSubjects as the citable commit-subjects source, and evidence validation accepts commit-subjects or commitSubjects as a whole-source citation
- [ ] #7 Awaiting, completed, replayed, and recalibrated stage records retain the captured commitSubjects in the embedded StageJudgeInput
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the validated planning and delivery capture results with oldest-first subjects from their existing baseline..result range. Query once unconditionally; reuse the delivery list for optional convention validation.
2. Add optional `commitSubjects` to `StageJudgeInput`, populate it only for stages whose validated history advanced, and rely on shared `executeStageSession` for forward and replay parity.
3. Add `commit-subjects` to the evidence schema, whole-source path map, and Judge prompt.
4. Drive the change through real-git capture tests first, then stage-loop/replay, citation/prompt, and persisted-record tests.
<!-- SECTION:PLAN:END -->
