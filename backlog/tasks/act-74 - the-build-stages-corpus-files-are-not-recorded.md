---
id: ACT-74
title: a stage that fails its grade gate loses its corpus record
status: Done
assignee: []
created_date: '2026-09-05 00:41'
updated_date: '2026-09-06 23:07'
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
- [x] #1 A stage record written after the stage fails its grade gate lists the corpus files the stage captured (observed: run 2026-09-06T21-58-29.508Z build record, STAGE_JUDGE_FAILED, has no corpusFiles key while its shape record has 89)
- [x] #2 A build stage that clears its grade gate writes a record listing every corpus file it read, as the shape stage's record does (card's original criterion #1, filed 2026-09-05)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build session, 2026-09-07. Fixed both criteria.

Fix: added `corpusFiles?: readonly HashedFile[] | undefined` to `PendingStage`
(run-abort.ts), populated it at the one construction site in run.ts (the value
was already destructured in scope from the stage session result), and included
`corpusFiles: pending.corpusFiles` in the record literal `writeStageJudgeFailure`
builds. Closes AC#1.

AC#2 needed no code change. A new test drives the existing fake-dependencies
harness (grades every stage CONTINUE/PASS) through a build stage and confirms
its completed record carries corpusFiles, same as the shape stage's — this was
already true on the normal completion path (run.ts stageRecord spread), per the
card's own trace. Confirmed by test rather than a live model run.

Review: six axes run (review-code skill), one round each.
- Spec: present for both AC, but flagged should-fix — the production wiring
  line in run.ts (the pendingStage corpusFiles field) was not exercised by any
  test; reverting it alone left the full suite green. Verified by the reviewer
  reverting and rerunning.
- Testing: independently found the same gap from the other side — my first
  draft of the AC#2 test exercised the CONTINUE/completeStage path, not the
  STOP/writeStageJudgeFailure path the card is about, so it was a near-duplicate
  of an existing shape-stage test and didn't guard the goal's actual target.
- Style: no defects. Two notes: PendingStage.corpusFiles is optional though its
  one producer always supplies it (kept optional to avoid touching unrelated
  existing test literals, out of scope); field ordering before the spreads in
  writeStageJudgeFailure has no collision risk (checked).
- Architecture: no findings. One observation: the AWAITING_STAGE_JUDGE pending
  write still omits corpusFiles, correctly out of scope (card only asks about
  the failed and completed records).
- Security: no findings (no untrusted input, no new sink).
- Refactoring: no findings.

Disposition: replaced the near-duplicate AC#2 test with an extension of the
existing STOP-verdict abort test ("keeps the judge's findings ... in the
aborted stage artifact after a normal grade failure", now also asserting
corpusFiles). Confirmed red (stashed the two production-file changes, test
failed with no corpusFiles key) then green (unstashed, full suite passes).

Verified this session: full suite 1061 pass/0 fail, lint clean, typecheck
clean, fmt:check clean.

Not verified: no live benchmark run against a real target repo. Both fixes are
proven at the unit/integration level with fakes; nobody has watched an actual
`run` command produce a STAGE_JUDGE_FAILED build record with corpusFiles
end-to-end.
<!-- SECTION:NOTES:END -->
