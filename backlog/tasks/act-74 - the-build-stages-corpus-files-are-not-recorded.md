---
id: ACT-74
title: a stage that fails its grade gate loses its corpus record
status: Build
assignee: []
created_date: '2026-09-05 00:41'
updated_date: '2026-09-06 23:01'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 70008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-05 while preparing ACT-39's replay.

The shape stage's record and its checkpoint both carry a corpusFiles list, nine entries naming CLAUDE.md, agents/reviewer.md, output-styles/brief.md, and the doctrine and shape skills. The build stage's record at .benchmark-runs/2026-09-05T00-21-40.070Z.build.json has no corpusFiles key at all.

The consequence: an edit to a file the build stage read cannot invalidate anything, because nothing records that it read it. Editing skills/build/SKILL.md and running stale reported no checkpoint. Only editing CLAUDE.md, which the shape stage recorded, produced a staleness line.

Worth separating: the build stage's input.instructions holds the global CLAUDE.md and does not contain the build skill's text, so the build stage may genuinely not receive that skill. Either way the record cannot distinguish 'read it and we did not record it' from 'never read it', and both break the replay story for delivery stages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stage record written after the stage fails its grade gate lists the corpus files the stage captured (observed: run 2026-09-06T21-58-29.508Z build record, STAGE_JUDGE_FAILED, has no corpusFiles key while its shape record has 89)
- [ ] #2 A build stage that clears its grade gate writes a record listing every corpus file it read, as the shape stage's record does (card's original criterion #1, filed 2026-09-05)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session running ACT-39's replay, which worked around it by editing CLAUDE.md instead. ACT-39's replay is of the shape stage for this reason.

2026-09-06, reproduced the symptom against a fresh run and found the stated cause is wrong.

Run 2026-09-06T21-58-29.508Z (audit-log, sonnet). Its shape record carries corpusFiles with 89 entries; its build record has no corpusFiles key. That matches the card's observation exactly.

But the build record's other keys are status, stage, error, input, hardBlockers, requirements, dimensions, summary, costUsd, with status STAGE_JUDGE_FAILED and error 'build stage graded C; minimum grade is B'. This record was not written by the normal path at all.

The normal path is run.ts:734, which spreads corpusFiles into every StageJudgeRecord with no branching by stage or kind. captureStageCorpus is called at run.ts:540 before any stage-kind branch, so a build stage does capture its corpus. The only kind-specific branch nearby (run.ts:567) governs build-candidate capture, not corpus recording.

The failure path is writeStageFailure in run-abort.ts:106-120. It constructs its record literal from scratch (status, stage, error, input, findings, failure) and never includes corpusFiles, though the stage had already captured them.

So: a build stage that fails its grade gate loses its corpus record. Whether a passing build stage records corpus is not shown by this run, because the build stage stopped at the gate and never reached the checkpoint write. The code says it would.

That makes the card's premise ('the build stage's corpus files are not recorded') too broad, and its criterion #2 rests on it. Reshaping is needed before building: the defect to fix is the failure writer dropping corpus files, and the open question is whether a passing build stage records them, which needs a run that clears the B gate.

Criteria rewritten 2026-09-06 at João's direction ('go', after being told the premise was wrong).

Dropped: 'stale reports a checkpoint invalidated by an edit to a file the build stage read'. It presumed build stages record no corpus at all, which the code contradicts, and it cannot be observed until a build stage clears the gate. Once criterion #2 holds, staleness follows from the same recorded digests the shape stage already uses, so the dropped criterion tested the mechanism rather than a behavior. If a build-read edit still fails to invalidate after #2 holds, that is a new card with its own evidence.

Kept and renumbered: the original criterion #1 is now #2, unchanged in substance.
Added: #1, the failure-path defect confirmed this session.
<!-- SECTION:NOTES:END -->
