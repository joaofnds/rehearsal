---
id: ACT-34
title: make the audit-log case's target resolvable from any checkout
status: To Do
assignee: []
created_date: '2026-09-03 11:55'
updated_date: '2026-09-04 01:50'
labels: []
milestone: m-2
dependencies: []
references:
  - ACT-30
priority: medium
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
- [ ] #3 A declaration whose target path is malformed or unresolvable for a reason other than the target's absence still fails rather than skipping
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decided by Joao, 2026-09-03 (triage question 5): a pipeline case may declare a target repository outside this one, and the test asserting the target exists skips rather than fails when it is absent. So this card does not relocate or vendor the NestJS template; it makes absence a skip.

What that leaves for Shape: a skipped test reports nothing, so a checkout that has the target and a checkout that does not now pass identically, and a genuinely broken declaration (a typo in the path) becomes invisible. The mechanism has to tell 'this machine does not have the sibling repository', which is expected, from 'this declaration is wrong', which is not. That distinction is the design work.

2026-09-04, runner: moved back to To Do. Its question was answered 2026-09-03 and no session is shaping it, so Shape read as work in progress beside ACT-28. Shape is for a card a session is shaping.

Triage 2026-09-04: the premise holds, but reproducing it needs a condition neither the description nor the 2026-09-03 measurement states. The declared path is relative, so a clone three directories deep under /Users/joaofnds/code still resolves ../../../nest/template to the real sibling and PASSES. The 2026-09-03 probe at /tmp/act30probe resolved to /nest/template, absent, which is why it failed there; a clone at a different depth would not have.

Reproduce with a clone placed where no `nest/` sibling resolves from three levels up:
  mkdir -p /tmp/deep/a/b/c && git clone <repo> /tmp/deep/a/b/c/rehearsal
  cd /tmp/deep/a/b/c/rehearsal && bun install --frozen-lockfile
  bun test src/benchmark/case.test.ts
Observed 2026-09-04 at 45c522c: 33 pass, 1 fail, ENOENT stat '/private/tmp/deep/a/b/c/nest/template'. The same file on this checkout: 34 pass, 0 fail.

This path-dependence is itself an argument for the card: whether the suite passes depends on where the checkout happens to sit, which is the property a test should never have.
<!-- SECTION:NOTES:END -->
