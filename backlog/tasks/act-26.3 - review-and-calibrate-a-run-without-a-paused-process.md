---
id: ACT-26.3
title: review and calibrate a run without a paused process
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 24008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today a run pauses at AWAITING_HUMAN_REVIEW with the candidate in the target and loops on "press Enter" until the review file and rubric edits validate, then asks "type yes" to confirm the revised Judge. An agent cannot hold that process. Make the pause optional: a run without --pause writes the preliminary artifact, pins the candidate under a retention ref, restores the target, and exits. rehearsal review <run> --file <review.json> (or --verdict, --summary, --finding flags) records the human or agent review; rehearsal calibrate <run> rejudges the frozen evidence with the current rubrics and instructions, validates the findings the way collectCalibration does today, and records the result, including the agreement snapshot, without asking anything; a --confirm-rejudge flag stands in for the typed yes. rehearsal show <run> --checkout <dir> materializes the retained candidate for inspection. --pause keeps today's flow for João.

Calibration already rejudges frozen evidence, not the live target, so nothing is lost by restoring first. Gap 4 in doc-1.
<!-- SECTION:DESCRIPTION:END -->
