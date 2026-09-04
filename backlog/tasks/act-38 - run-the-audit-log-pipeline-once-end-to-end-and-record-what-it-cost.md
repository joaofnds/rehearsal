---
id: ACT-38
title: 'run the audit-log pipeline once, end to end, and record what it cost'
status: To Do
assignee: []
created_date: '2026-09-04 01:50'
labels: []
milestone: m-1
dependencies: []
priority: high
ordinal: 40008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The tool has never run its own pipeline. `rehearsal list runs`, `list checkpoints`, `list groups`, and `list comparisons` all return empty on 2026-09-04 at 540ba9a; the only recorded evidence is nine session attempts of the smoke and brief-reply cases. Every capability in docs/design.md's path (pipeline as data, checkpoints, replay, invalidation, reps, comparison reporting) is built and unit-tested, and none has been exercised against a real pipeline.

This card is the first real use. Run `rehearsal run` on the audit-log case against the NestJS template, let it complete or stop, and record what actually happened: the wall-clock, the dollar cost, the stages that passed judgment, and every place the harness surprised the operator.

The point is not a green result. A run that stops at stage two is a successful outcome of this card if what stopped it is recorded. This is the walking skeleton the project never walked, and the unknowns it surfaces are the real backlog for m-1.

Cost is real money and unbudgeted. Ask João for the number before running.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal run` is invoked on the audit-log case and its outcome, complete or stopped, is recorded as a run artifact under .benchmark-runs/runs
- [ ] #2 `rehearsal list runs` returns at least one run, and `rehearsal show` on its id prints the artifact
- [ ] #3 The run's wall-clock, dollar cost, and per-stage judge results are recorded on this card
- [ ] #4 Every place the harness refused, surprised, or misled the operator during the run is recorded on this card, one line each, as a candidate card
<!-- AC:END -->
