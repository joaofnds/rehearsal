---
id: ACT-89
title: >-
  run the checks through the pinned toolchain instead of asking sessions to
  remember
status: To Do
assignee: []
created_date: '2026-09-06 00:22'
updated_date: '2026-09-06 00:22'
labels: []
dependencies: []
ordinal: 85008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running the project's test script uses the Bun version mise.toml pins, whatever the ambient version is
- [ ] #2 A session that runs the test script on a machine whose default Bun differs from the pin sees the suite pass, not the version gate
- [ ] #3 The instruction telling sessions to type the prefix is removed once the mechanism makes it unnecessary
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Raised 2026-09-06 from an instruction review during ACT-34.

Two sessions on ACT-34 ran bare 'bun test', saw 48 failures, and reported them as a real pre-existing defect belonging to other cards. All 48 were one cause: rehearsal.ts:43 throws unless Bun.version equals REQUIRED_BUN_VERSION (src/benchmark/config.ts:5, '1.4.0'), and this machine's default bun is 1.4.1, so every test that starts the CLI as a subprocess failed. The failing test names say nothing about versions ('prints the flag table for rehearsal run --help'), which is why the cause was missed twice.

CLAUDE.md now tells sessions to prefix CLI-starting commands with 'mise exec --'. That is prose where a mechanism fits. The independent reviewer's finding: a session that skips the prefix on lint or typecheck gets a clean green and no signal at all, so a compliant run and a non-compliant one are indistinguishable except by accident.

Verified 2026-09-06: mise.toml pins bun 1.4.0 and the pin is directory-scoped. Inside the repo 'mise exec -- bun --version' is 1.4.0; outside it is 1.4.1. package.json scripts run bare today ('test': 'bun test') and mise.toml declares only [tools], no tasks. Either route would work.

Not done in the ACT-34 session because it edits build configuration beyond the instruction fix João approved. The reviewer named the mechanism and stopped short of prescribing the edit for the same reason.

Bare 'bun run lint', 'bun run typecheck', and 'bun run fmt:check' all pass on 1.4.1, so only the CLI-starting commands are affected today. That is a property of the current checks, not a guarantee.
<!-- SECTION:NOTES:END -->
