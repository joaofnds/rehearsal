---
id: ACT-84
title: fail loudly when the shell's bun is not the pinned version
status: Shape
assignee: []
created_date: '2026-09-05 21:09'
updated_date: '2026-09-09 16:23'
labels: []
milestone: m-2
dependencies: []
priority: low
type: chore
ordinal: 80008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make every supported test/CLI entry path report a Bun-pin mismatch by name; remove manual-prefix guidance only once all paths enforce it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running the test suite under a Bun version other than the pinned one reports the mismatch by name instead of failing unrelated tests
- [ ] #2 The mismatch is visible without the operator knowing to compare versions themselves
- [ ] #3 The instruction telling sessions to type the toolchain prefix is removed once the mechanism makes it unnecessary
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed 2026-09-05 during ACT-45's build session. The shell's default bun was 1.4.1 against the repository's 1.4.0 pin, and 47 unrelated tests failed silently until mise was activated. Nothing named the version as the cause, so the failures read as real defects in the code under test.

This is a poka-yoke gap. A version mismatch is a condition the system can detect and refuse, and today it is left to the operator noticing that a suite which should be green is not. The cost is a session spent chasing 47 phantom failures, which is what nearly happened.

Reproduce by running the suite with a bun that is not the pinned version and observing that the failures name assertions rather than the version.

ACT-89 merged into this card 2026-09-06 and closed as a duplicate. That card was created without checking the board; this one already described the same defect, written the day before it recurred.

Evidence carried over from ACT-89, observed 2026-09-06 during ACT-34:

Two sessions ran bare 'bun test', saw 48 failures, and reported them as a real pre-existing defect belonging to other cards. All 48 were one cause. rehearsal.ts:43 throws unless Bun.version equals REQUIRED_BUN_VERSION (src/benchmark/config.ts:5, '1.4.0'), and the machine's default bun is 1.4.1, so every test that starts the CLI as a subprocess failed. The failing test names say nothing about versions ('prints the flag table for rehearsal run --help'), which is why the cause was missed twice. This is the second recurrence of the ACT-45 incident this card was written from.

Verified 2026-09-06: mise.toml pins bun 1.4.0 and the pin is directory-scoped. Inside the repo 'mise exec -- bun --version' is 1.4.0, outside it is 1.4.1. package.json scripts run bare today ('test': 'bun test') and mise.toml declares only [tools], no tasks. Either route would carry the mechanism.

Bare 'bun run lint', 'bun run typecheck', and 'bun run fmt:check' all pass on 1.4.1, so only CLI-starting commands are affected today. That is a property of the current checks, not a guarantee.

Criterion #3 is new, carried from ACT-89. CLAUDE.md now tells sessions to prefix CLI-starting commands with 'mise exec --' (commit a24191c). That prose is a stopgap. An independent reviewer's finding: a session that skips the prefix on lint or typecheck gets a clean green and no signal at all, so a compliant run and a non-compliant one are indistinguishable except by accident. Once the mechanism lands, the instruction comes out.

Triage 2026-09-08 (d): version drift only, no substance change. bun --version outside the repo is now 1.4.2 (cited 1.4.1); the mismatch condition and every other described behavior (bare bun test/lint/typecheck/fmt:check, mise exec -- prefix in CLAUDE.md, REQUIRED_BUN_VERSION check now at rehearsal.ts:47) check out exactly as described.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: low. The historical mismatch failure is plausible but absent today, and the enforcement boundary is unsettled.

Evidence: bun and mise bun both report 1.4.0; package scripts invoke bare bun; rehearsal.ts alone checks the pin.

Unresolved claims/resources: None for the next action.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Design and test one enforcement path using an explicit alternate Bun binary; retain the CLAUDE prefix until direct invocation is covered.

Record: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
