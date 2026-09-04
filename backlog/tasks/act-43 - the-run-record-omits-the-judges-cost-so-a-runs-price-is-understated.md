---
id: ACT-43
title: 'the run record omits the judge''s cost, so a run''s price is understated'
status: To Do
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-04 14:46'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 45008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The only costUsd in a run record belongs to the workflow session. The stage judge runs as its own provider session and its spend is recorded nowhere.

Observed 2026-09-04 in ACT-38 record .benchmark-runs/2026-09-04T02-09-23.870Z.shape.json: the shape session reports costUsd 0.4304174 across two provider calls, and that is the only cost figure in a 92 KB artifact. A judge session ran, producing the graded verdict in that same record, and contributed nothing to the cost accounting.

docs/vision.md makes cost a first-class output: projected cost is shown before a multi-rep or multi-variant run, and cost is reported beside quality so verbosity cannot score as improvement. A judge runs on every stage transition and on the final delivery, so the omission scales with the pipeline length and is largest exactly where the tool is most expensive.

Reproduce by loading any run record as JSON and collecting every costUsd field; only the workflow session has one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run record carries the judge sessions' cost as well as the workflow sessions'
- [ ] #2 A run's total reported cost equals the sum of every provider session the run caused, checked against one real run's record
- [ ] #3 A confirmation group's projected cost accounts for judge sessions, so the projection is not systematically low
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, moved to m-1. It was on m-3 as evidence hygiene. The design makes it visible: SPEC.md shows the judge as 'independent session · $0.08' in the judge pane, so the omission becomes a number the operator reads rather than a field a record lacks. It also belongs with proving the loop, since a comparison that understates cost cannot answer whether an edit was worth its price.
<!-- SECTION:NOTES:END -->
