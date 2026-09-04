---
id: ACT-54
title: 'stream a run''s state while it runs, instead of only recording it at the end'
status: To Do
assignee: []
created_date: '2026-09-04 13:06'
updated_date: '2026-09-04 13:07'
labels: []
dependencies:
  - ACT-48
priority: high
ordinal: 56008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design`s central screen watches a run in flight. The harness cannot be watched: it writes a record when a stage finishes and prints progress to stdout in between.

docs/design-handoff/SPEC.md, live monitor and persistent status bar, needs while a run is in progress: elapsed seconds, spend accrued so far against the ceiling, burn rate per minute, tokens in and out, which step is current and its status, the current tool call, per-step cost and duration as they complete, and checkpoint ids as they are recorded. It names the transport as "server-pushed in production, SSE or a websocket off the run process".

The status bar is required to be visible from every screen whenever a run is in flight, because Joao starts a run and leaves. That makes this not a monitor-screen feature but a property of the whole application.

What exists: run.ts prints progress lines to stdout (14 console.log sites, ACT-26.7), and writes the run artifact at the end. Spend is enforced per session via --session-budget-usd but is not observable mid-run. Nothing publishes state.

The harness side of this is a stream of run events. The UI side consumes it. This card is the harness side only, and it should be shaped before it is built: whether the run process publishes events directly, or writes them to a file the UI tails, is a real design decision with different failure behavior when the UI is not running.

Note the interaction with ACT-26.7: that card routes harness progress off stdout so --json is parseable. This card gives that progress somewhere better to go than stderr. Doing 26.7 first and this second means the writer moves twice; shaping them together is probably right.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run in progress publishes its state where a reader outside the run process can observe it, and the mechanism is recorded on the card with its failure behavior when no reader is attached
- [ ] #2 The published state carries at minimum: current step and its status, spend so far, elapsed, and each step's cost and duration as it completes
- [ ] #3 A reader that attaches midway through a run gets the current state, not only subsequent changes
- [ ] #4 An interrupted run's published state is reconcilable on restart, so a reader can tell in-flight from abandoned
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
