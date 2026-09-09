---
id: ACT-27
title: split each CLI command module's harness wiring from its command policy
status: To Do
assignee: []
created_date: '2026-09-02 21:16'
updated_date: '2026-09-09 16:23'
labels: []
dependencies:
  - ACT-26.7
priority: low
ordinal: 28008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split command policy from production harness wiring; the old lint blocker and old line counts no longer apply.
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

Priority 2026-09-08: Low to Medium, directed by João. The premise both this card and ACT-31 were held Low on ('the tool has never run its own pipeline') is verified false this session: rehearsal.ts list runs shows run:2026-09-06T21-58-29.508Z (audit-log, STOPPED:build, replayable). The lint rule that reverted the first split attempt is also off (.oxlintrc.json:98, import/prefer-default-export), so the shape of the original attempt is legal again. Line counts have drifted further: run-command.ts 438, replay-command.ts 406. Still queued behind ACT-26.7 per doc-28's bundle ordering.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: low. The mixed policy/wiring modules are real maintenance debt without current operator harm.

Evidence: run-command.ts is 438 lines, replay-command.ts 410, and prefer-default-export is disabled.

Unresolved claims/resources: ACT-26.7

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Extract cohesive production wiring after the output seam settles.

Record: [backlog/docs/doc-61 - Triage-rehearsal-backlog.md](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
