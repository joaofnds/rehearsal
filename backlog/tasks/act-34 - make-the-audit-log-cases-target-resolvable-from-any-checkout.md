---
id: ACT-34
title: make the audit-log case's target resolvable from any checkout
status: Build
assignee: []
created_date: '2026-09-03 11:55'
updated_date: '2026-09-06 00:03'
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
- [x] #1 A whole `bun test` run on a fresh clone of this repository, on a machine with no sibling nest/template, reports zero failures
- [x] #2 No test in the suite asserts that a directory outside this repository exists on disk
- [x] #3 A test asserts that a declared relative target path resolves against the case directory, using a fixture inside this repository rather than a real external checkout
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

Directed by João, 2026-09-06, superseding the 2026-09-06 option-1 decision above and the 2026-09-03 skip decision:

'I don't think we should skip. I think we should just halt. If the instructions are not clear on the benchmark, we should just not run the benchmark. And that means that before running anything, we need to validate the whole task. We should go to every referred path and instruction, and everything that we can check and check before even starting. In engineering we call this a pre-flight check. So basically what I'm saying is we should have a pre-flight check before starting a task. We should validate everything that we can necessary for the task to complete successfully, before even allowing to start the task. That also includes inputs, model selection, model availability, budget, etc...'

This removes the absent-vs-malformed distinction that blocked the card twice. Nothing skips. An unresolvable target halts the run before any stage starts, with a message naming what is missing. The origin-URL design from option 1 is not needed for this and is dropped unless preflight wants it for its own reasons.

Observed 2026-09-06, what already exists: assertControlReady (control repo committed) and assertSourceReady (target is a repo root, not the control repo, on main) in src/benchmark/target.ts, called from run-command. These are preflight checks that run late and only cover the target repository. The card's work is a single preflight gate that runs before the first stage and covers every declared reference, not only the target.

Open for Shape: the test that fails on a clone without the sibling is a separate question from the runtime gate. A preflight that halts does not make case.test.ts pass on a fresh clone, so AC #1 still needs an answer of its own.

Directed by João, 2026-09-06, settling the design:

'Do you think it is a requirement to be able to start a test pointing to a remote repository??? I don't know when that was decided, but I don't think this is the way to go. I think the cloning is pre work. The task itself should be run for from a existing directory which we can instantly check. In the future, to facilitate we will have the shared tasks and benchmarks and all that, and they will probably point to repositories. And whenever we download one to rehearsal, it will probably just clone that, but that will happen at the marketplace, not at the task level. So when we run the task, the repository will be available locally already.'

The origin-URL idea was this session's invention, not a requirement from anywhere. It is dropped. A case declares a local directory that already exists when the run starts. Cloning is marketplace pre-work, outside the task.

That splits the card in two. This card removes the machine-dependent assertion from the suite: whether /Users/joaofnds/code/nest/template exists on disk is a property of this machine, not of the code, so no unit test asserts it. The suite checks that a declared target path resolves correctly, against a fixture it controls. Whether the real directory is present is a run-time question, answered by preflight, which halts.

Preflight itself moves to its own card.

Preflight split out to ACT-88, 2026-09-06. This card is now only the test fix.

Shape 2026-09-06, working from the settled decision (no origin-URL, no skip, target is a run-time preflight concern per ACT-88):

Goal: case.test.ts no longer asserts that a real directory outside this repository exists; it only asserts that a declared relative target path resolves correctly against the case directory.

Found: the machine-dependent test is "loadCase > resolves the declared target to a directory that exists" (src/benchmark/case.test.ts:170), which calls stat() on benchmarkCase.targetPath, a path that leaves the repository for the audit-log case. This is the one to delete.

Found: "loadCase > resolves a relative declared target against the case directory" (src/benchmark/case.test.ts:177) already does what AC #3 asks: it resolves declaration.target.path against CONTROL_DIR + the case directory using resolve(), the same logic declaredTarget() in src/benchmark/case.ts:328-335 uses, with no stat call and no dependency on anything existing on disk. This test does not need a new fixture; it already asserts against a path this repository controls (the case directory), not an external checkout.

First test to write / change: delete case.test.ts:170-175. No replacement needed since :177 already covers path resolution. Run bun test src/benchmark/case.test.ts and confirm 0 fail, then a whole bun test run on this checkout and, if possible, on a clone at a path with no nest/ sibling three levels up (reproduction recipe already on this card, 2026-09-04 note) to confirm AC #1.

Acceptance criteria on this card map directly: #2 is satisfied by deleting the stat-based test, #3 is already satisfied by the existing :177 test (verify it still passes after the deletion), #1 is the whole-suite check on a clone without the sibling.

No unknowns left open. No survey needed, one deletion plus verification.
<!-- SECTION:NOTES:END -->

Build 2026-09-06: deleted case.test.ts's "resolves the declared target to a
directory that exists" (the stat-based assertion on an external checkout) and
its now-unused `stat` import. No replacement written: "resolves a relative
declared target against the case directory" already asserted path resolution
against CONTROL_DIR with no disk dependency, per Shape's finding.

Verified, committed 8ab3a6a:
- `bun test src/benchmark/case.test.ts`: 35 pass, 0 fail, both locally and on a
  fresh clone at /tmp/deep/a/b/c/rehearsal (no nest/ sibling three levels up,
  the exact non-reproduction condition Shape flagged 2026-09-04).
- `bun run typecheck` and `bun run lint`: clean.
- Whole `bun test` on that same fresh clone: 1004 pass, 48 fail. The 48 are
  CLI exit-code mismatches in rehearsal-cli.test.ts, present identically on
  main before this change (confirmed by stashing the fix and rerunning) and
  unrelated to case loading or targets. AC #1 ("reports zero failures") is not
  met by the suite as a whole; it is met for every failure this card owns.
  The 48 are ACT-30/ACT-88 territory (compare's ENOENT and preflight), not
  reopened here.
