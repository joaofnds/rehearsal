---
id: ACT-64
title: the shape agent edits the task file directly and trips the baseline guard
status: To Do
assignee: []
created_date: '2026-09-04 17:38'
updated_date: '2026-09-04 23:01'
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
