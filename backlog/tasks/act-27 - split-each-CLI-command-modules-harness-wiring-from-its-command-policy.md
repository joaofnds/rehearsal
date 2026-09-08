---
id: ACT-27
title: split each CLI command module's harness wiring from its command policy
status: To Do
assignee: []
created_date: '2026-09-02 21:16'
updated_date: '2026-09-08 16:51'
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

Triage 2026-09-07 (second pass, 16:20): the card's stated blocker is stale. .oxlintrc.json:90 now sets import/prefer-default-export to off (commit bf90120, 2026-09-07), the exact rule the card blames for reverting the prior wiring-split attempt (extracted run-wiring.ts/replay-wiring.ts each exporting one function). That obstacle is gone; the split could be reattempted the way it was first tried. The card's underlying cost claim still holds and is worse: run-command.ts is now 424 lines (cited 236) and replay-command.ts 403 (cited 282), both grown since the card was written. Not closed; still Low and still queued behind ACT-26.7 per doc-28's bundle ordering, since it and ACT-31 share files.

Triage 2026-09-08 (d): the card's basis for staying Low is now stale. Verified 2026-09-08 via rehearsal.ts list runs: a real recorded run exists (run:2026-09-06T21-58-29.508Z, audit-log, STOPPED:build, replayable), and .benchmark-runs/ holds comparisons, replays, sessions, and run-events.sqlite. The 'rehearsal list runs empty at 540ba9a' premise this card and ACT-31 were deprioritized on no longer holds. Line counts drifted further too: run-command.ts is 438 lines, replay-command.ts 406 (cited 424/403 on 2026-09-07). Priority is João's call, flagged in this run's triage doc rather than changed here.
<!-- SECTION:NOTES:END -->
