---
id: ACT-34
title: make the audit-log case's target resolvable from any checkout
status: Shape
assignee: []
created_date: '2026-09-03 11:55'
updated_date: '2026-09-03 11:55'
labels: []
dependencies: []
references:
  - ACT-30
ordinal: 36008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
cases/audit-log/case.json declares `target.path` as `../../../nest/template`, relative to the checkout. On this machine that resolves to /Users/joaofnds/code/nest/template, which exists. On any clone elsewhere it does not, so `loadCase > resolves the declared target to a directory that exists` (src/benchmark/case.test.ts) fails with `ENOENT: no such file or directory, stat '<clone>/../../../nest/template'`.

Measured 2026-09-03 on a fresh clone at 516e842: it is the only failure in a whole `bun test` run, 1015 pass, 1 fail. The same checkout runs 1016 pass, 0 fail locally.

Split from ACT-30, whose criterion #2 ("a fresh clone of this repository runs bun test green on its first run") this is the remaining obstacle to. ACT-30's own defect, compare's raw ENOENT, has a different cause and is invisible in a whole-suite run because an earlier test creates .benchmark-runs.

The decision this needs: whether a case may declare a target outside the repository at all, and if so whether a test asserting its existence should skip rather than fail when the target is absent. A pipeline case needs a real target repository to run against, and committing a copy of the NestJS template into this repository is a different trade. That choice is why this is its own card.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A whole `bun test` run on a fresh clone of this repository, on a machine with no sibling nest/template, reports zero failures
- [ ] #2 The decision on whether a pipeline case may declare a target outside the repository is recorded on this card with its reason
<!-- AC:END -->
