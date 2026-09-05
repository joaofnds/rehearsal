---
id: ACT-34
title: make the audit-log case's target resolvable from any checkout
status: To Do
assignee: []
created_date: '2026-09-03 11:55'
updated_date: '2026-09-05 23:43'
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

Shape 2026-09-06 stopped on AC #3's distinction and recommended option 2: skip only when the declared target resolves outside the control repository, fail otherwise.

Oversight probe 2026-09-06 refutes that recommendation. Resolving the declared path and testing it with relative(CONTROL_DIR, abs) classifies these identically:
  ../../../nest/template  -> /Users/joaofnds/code/nest/template  outside=true
  ../../../nest/tempalte  -> /Users/joaofnds/code/nest/tempalte  outside=true (typo)
  ../../../nsst/template  -> /Users/joaofnds/code/nsst/template  outside=true (typo)
A typo in an external path stays outside the repository, so option 2 skips it. It catches only a broken path that stays inside the repo, which is not the failure mode the audit-log declaration has. Against AC #3 it buys nothing over option 1.

Verified separately: test.skipIf works, evaluated before the test body (bun 1.4.1, probe at /tmp/skipprobe). The mechanism is settled; only the absent-vs-malformed line is open.

What the filesystem cannot answer: no stat-based check distinguishes an uncloned sibling from a misspelled sibling. Closing AC #3 needs a fact outside the filesystem, e.g. the declaration naming the target's origin (a git URL or a repo identity) so absence is checked against something verifiable, or AC #3 being rewritten to a weaker guarantee.

Decided by João, 2026-09-06: option 1. The case declaration carries where its target comes from, so absence is checked against something verifiable and a wrong path is a mismatch rather than a silence. This widens the card beyond a bare skip, and that is accepted. Option 2 (skip when the path resolves outside the repository) is rejected: the 2026-09-06 probe above shows it classifies a misspelled external path the same as a correct one, so it skips the typo it exists to catch.

Shape works from this decision. AC #3 stands as written and is now closable: a declaration whose target is malformed or unresolvable for a reason other than the target's absence still fails.
<!-- SECTION:NOTES:END -->
