---
id: ACT-27
title: split each CLI command module's harness wiring from its command policy
status: To Do
assignee: []
created_date: '2026-09-02 21:16'
updated_date: '2026-09-04 01:51'
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
Triage 2026-09-04, ranked against the project's goal. Stays Low, and deliberately unassigned to a milestone.

The tool has never run its own pipeline (`rehearsal list runs` empty at 540ba9a). Until m-1 produces a comparison somebody reads, internal restructuring changes nothing an operator can observe. These three are the last work to do, not the next.

One exception worth watching: ACT-26.7 becomes real the moment anything consumes `run --json` programmatically, because harness prose on stdout makes the record unparseable. If m-1's run is driven by hand and read by eye, that does not bite. If it is scripted, ACT-26.7 blocks it and should be pulled forward.
<!-- SECTION:NOTES:END -->
