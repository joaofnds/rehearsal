---
id: ACT-53
title: stand up the stack end to end on one screen
status: To Do
assignee: []
created_date: '2026-09-04 14:20'
labels: []
milestone: m-4
dependencies:
  - ACT-48
  - ACT-52
priority: high
ordinal: 55008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-3 settles the stack. This proves it works end to end before nine screens are built on it, and stops at one screen rather than scaffolding all of them.

Run history is the right screen: it is the landing view, it reads records that already exist on disk, and it needs no event stream. So this card exercises every layer except the one ACT-51 adds.

What it wires:
- Hono on Bun, serving the client bundle and a read API
- the read API going through the CLI read paths (listRecords, recordFileFor, parseRecordId) rather than new record access, so the id-traversal refusal guards the UI too
- React with Vite, TanStack Query and Router
- the design system from ACT-52, with every value coming from it
- Vite as the only added build step, alongside the existing typecheck, lint, fmt, and bun test

Not in scope: SQLite and the event stream (nothing streams until ACT-51), Radix (no dialog on this screen), TanStack Table (add it when sorting and filtering are actually built, not before).

The point is the wiring, not the screen. A second screen should be a matter of adding a route and components, and if it is not, this card has not finished its job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run history renders in a browser from records in a real .benchmark-runs directory, including the stopped run recorded 2026-09-04 and a record marked stale
- [ ] #2 Its empty state renders on a checkout with no records at all
- [ ] #3 A record id that would escape the runs directory is refused by the server, proven by a test over the route
- [ ] #4 An unreadable record appears in place with its reason and no raw filesystem error reaches the browser
- [ ] #5 typecheck, lint, fmt:check, and bun test all pass with the client and server in the tree, and the lint rule from ACT-52 fails the build on a raw colour or spacing value
- [ ] #6 A second screen needs a route and components only, with no further wiring; state on the card what a reader would have to add
<!-- AC:END -->
