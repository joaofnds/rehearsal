---
id: ACT-27
title: split each CLI command module's harness wiring from its command policy
status: To Do
assignee: []
created_date: '2026-09-02 21:16'
updated_date: '2026-09-03 11:58'
labels: []
dependencies:
  - ACT-26.7
priority: low
ordinal: 28008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/cli/run-command.ts and src/cli/replay-command.ts each hold two things that change for different reasons: the command policy (parse flags, gate on a terminal, report the record) and the harness wiring (executeRun/confirmRun and executeReplay/currentControlSha, which assemble the dependency lists the harness needs and reach the provider). The policy half is unit tested with injected fakes; the wiring half cannot be tested without paid work, and it changes whenever a harness dependency list changes.

Splitting it was attempted during ACT-26.1 build and reverted: the extracted run-wiring.ts and replay-wiring.ts each export one function, which oxlint's import/prefer-default-export rejects, and pairing an arbitrary second export to satisfy it would be worse than the duplication. The guard's refusal indicts that shape of the change, so the split needs a design that produces cohesive modules: either both wirings in one src/cli/harness-wiring.ts, or the dependency lists themselves extracted as named values the wiring composes.

Cost of leaving it: run-command.ts is 236 lines and replay-command.ts 282, most of it dependency assembly that a reader must scroll past to find the command's behavior, and a harness dependency change edits a file whose tests are about CLI contracts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 src/cli command modules contain command policy only; a reader finds the flag parsing, the terminal gate, and the record reporting without scrolling past a dependency list
- [ ] #2 the harness wiring lives in a module whose tests, or absence of tests, are explained by its reaching the provider
- [ ] #3 bun run lint passes without a new suppression or an export added only to satisfy prefer-default-export
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: the description says run-command.ts is 236 lines and replay-command.ts 282. `wc -l` now returns 406 and 265. run-command.ts grew by 170 lines after the card was filed, so the cost of leaving it is larger than the card states, not smaller.

Triage 2026-09-03: depends on ACT-26.7. This card moves the harness wiring out of src/cli/run-command.ts and replay-command.ts, and that wiring is where the dependency lists handed to the harness are assembled. ACT-26.7 adds an injected writer to those same lists (its acceptance #5). Doing ACT-26.7 first means the writer arrives before the wiring is relocated, so it is moved once. Neither card's acceptance changes; this is ordering only.
<!-- SECTION:NOTES:END -->
