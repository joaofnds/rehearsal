---
id: ACT-26.2
title: >-
  list and show recorded runs, checkpoints, attempts, groups, comparisons, and
  staleness
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 23008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
To replay today, a session must read .benchmark-runs and parse timestamp names; to read a report it opens JSON under a SHA-named directory; nothing prints a confirmation or comparison report; the corpus-to-stage staleness ACT-4 computes is not queryable. Add rehearsal list <cases|runs|checkpoints|attempts|groups|comparisons> and rehearsal show <id>, where every ID printed is one the CLI accepts back as an argument. show prints the record with --json and a short markdown summary a session can paste onto a card: for a run, stages, grades, verdict, cost; for a group, the reliability summary (success rate, standard error, pass^k) and cost; for a comparison, the paired deltas beside the control arm. Add rehearsal stale [--corpus <source>], listing the checkpoints and cases an edit invalidated so a session knows what to re-run.

Why: jobs 4 and 5 in doc-1; the bespoke harnesses kept results in markdown because nothing gave them a citable, retrievable record.
<!-- SECTION:DESCRIPTION:END -->
