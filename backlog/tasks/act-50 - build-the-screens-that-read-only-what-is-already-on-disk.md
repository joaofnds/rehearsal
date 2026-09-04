---
id: ACT-50
title: build the screens that read only what is already on disk
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-04 13:23'
labels: []
milestone: m-4
dependencies:
  - ACT-47
  - ACT-48
  - ACT-49
  - ACT-52
priority: medium
ordinal: 52008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The first shippable slice of the UI: every screen whose data the harness already records. Run history, run detail, comparisons, corpus, cases, and calibration all read durable records under .benchmark-runs and declarations under cases/.

This deliberately excludes the live monitor, which needs a run in flight and has no data source today. See the live-monitor card.

Build against the committed design, not against a description of it, so this waits on the export card. It also waits on the vocabulary decision, because every label and route depends on it.

Reuse the read paths the CLI already has rather than reimplementing record reading: `listRecords(kind, runsDirectory)` in src/cli/list-command.ts returns entries plus the records it could not read, and show-command.ts maps a parsed record id to its file. Going through those means the id-traversal refusal that guards `show` guards the UI too, and a record the CLI cannot read is reported rather than crashing a listing.

Two behaviors the design gets right and the current CLI gets wrong, so the UI must not copy the CLI: a stopped run is a normal outcome and must render as one rather than an error (ACT-44 covers the CLI half), and an unreadable record is reported in place with its reason rather than as a raw ENOENT (ACT-40).

Stack: TypeScript on Bun, no framework unless the design demands one, consistent with the project's stated constraints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run history renders every recorded run from a real .benchmark-runs directory, including the stopped run recorded on 2026-09-04
- [ ] #2 A run whose record is missing or unparseable appears in place with its reason, and no raw filesystem error reaches the screen
- [ ] #3 A stopped run renders as a recorded outcome, visually distinct from an error, matching the design
- [ ] #4 Every screen has the empty state the design specifies, observed on a checkout with no records at all
- [ ] #5 A record id that would escape the runs directory is refused, proven by a test over the served routes
- [ ] #6 Introduces no raw visual value and no component the design system does not already own; anything new is added to the system, per decision-2
<!-- AC:END -->
