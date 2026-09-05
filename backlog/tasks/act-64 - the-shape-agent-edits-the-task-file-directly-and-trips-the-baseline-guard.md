---
id: ACT-64
title: the shape agent edits the task file directly and trips the baseline guard
status: To Do
assignee: []
created_date: '2026-09-04 17:38'
updated_date: '2026-09-05 00:19'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 61008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Observed 2026-09-04 in the audit-log run recorded at .benchmark-runs/2026-09-04T17-34-35.900Z.shape.json, the ACT-41 verification run.

The shape stage graded F on the invalid-stage-delivery hard blocker. The harness reported 'Target baseline changed unexpectedly' and the transcript corroborates it: the agent wrote the task card file directly twice instead of going through the backlog CLI, and the first direct write wiped the card's frontmatter and content before it restored them. It disclosed this in its completion message.

This is a corpus finding, not a harness defect. The board skill forbids editing files under the board directory, and the agent read that instruction and did it anyway. Two candidate causes worth separating before any fix: the instruction is stated but not prominent enough at the moment of writing a card, or the backlog CLI lacks an affordance the agent needed and the direct write was the path of least resistance. Read the transcript for which.

Not the same defect as the previous run's F. That one (record 2026-09-04T02-09-23.870Z) was ACT-41: the agent received rehearsal's own CLAUDE.md and lost grade for reporting the contradiction. ACT-41 is fixed and verified in this same run, where the agent received the global corpus instructions and raised no instruction question at all.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pipeline run of the audit-log case completes its shape stage without a 'Target baseline changed unexpectedly' harness failure
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced 2026-09-05 in .benchmark-runs/2026-09-04T23-53-48.458Z.shape.json, cost 0.4533 USD. Second occurrence, and the cause is NOT the one this card names.

The direct-write did not recur. This run's agent used the backlog CLI throughout and its completion message reports no direct file edits. So the card's stated cause, the agent editing the task file directly, is not what failed this time.

What the guard actually checks, src/benchmark/target.ts:248-257 in capturePlanningAdvance: a planning stage may commit (an advanced HEAD is explicitly allowed as evidence), but it must be on the expected branch and 'git status --porcelain=v1 --untracked-files=all' must be empty. So the failure is an unclean worktree, not a rewritten baseline.

The likely leftover is the GLOSSARY.md and CLAUDE.md this agent created in the target and, on the evidence of the guard firing, did not commit. That matches the project's own stage-hygiene rule, which requires committing every workflow artifact a stage creates before declaring the stage complete.

So this card should be re-scoped. Its acceptance criterion still holds, but the fix is about a planning stage leaving uncommitted artifacts, and the corpus instruction that should prevent it, rather than about direct file writes.

One harness defect worth separating: 'Target baseline changed unexpectedly' is raised for three distinct conditions (wrong branch, wrong SHA, dirty worktree) at two call sites, and harnessFailure records only that string. Nothing says which condition fired or which paths were dirty, so diagnosing this needed reading the source. Filed as ACT-72.

Consequence: this blocks ACT-39. Without a passing shape stage there is no checkpoint, and without a checkpoint there is no replay. Grade would have been B across all four dimensions without this blocker, which is the passing minimum.

Blocked on ACT-72, noted 2026-09-05. Fixing this needs to know which paths the stage left uncommitted, and nothing records them. The target repo was restored after the run, the artifact has no corpusFiles and no dirty-path list, and harnessFailure is the bare message. ACT-72 makes the guard record them, so the next run names the files instead of leaving them to be guessed.
<!-- SECTION:NOTES:END -->
