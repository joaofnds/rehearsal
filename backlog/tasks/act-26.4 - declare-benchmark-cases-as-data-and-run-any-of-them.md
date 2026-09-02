---
id: ACT-26.4
title: declare benchmark cases as data and run any of them
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 25008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today there is exactly one case, hardcoded: backlog-seed.md, product-brief.md, rubric.md, and rubrics/ at the control root, the target from --target, the pipeline from --pipeline. A second task, or ACT-25's non-pipeline case, has nowhere to go. Move the case to cases/audit-log/ (task, brief, final rubric, stage rubrics, pipeline, target declaration) and make it the default when --case is absent. rehearsal run --case <id> runs any declared case; rehearsal case list and case show read them; the run, group, and comparison records name the case they ran, and comparison pairs arms per case as the glossary already says. Cases live in this repository, never beside the corpus: the dotfiles evals sat beside the agent they graded and were deleted with it at the corpus swap.

This is the prerequisite for ACT-26.5 and the first thing the scripts needed. Gap 1 in doc-1.
<!-- SECTION:DESCRIPTION:END -->
