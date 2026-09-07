---
id: ACT-50
title: build the comparison and corpus screens
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-07 22:59'
labels: []
milestone: m-7
dependencies:
  - ACT-47
  - ACT-48
  - ACT-49
  - ACT-52
  - ACT-53
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
- [ ] #7 Building the comparison screen touched only a new Router route file, its page component, and any new files under client/src/system/components/ -- stated as a prediction on ACT-53 AC #9 and confirmed or corrected here (moved from ACT-53 on João's direction, 2026-09-07: 'I agree' to closing ACT-53 whole by moving AC #9 onto ACT-50)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04: narrowed. This card said 'every screen whose data the harness already records', which is six screens in one batch and the opposite of shipping small.

Run history now belongs to ACT-53, which builds it as the walking skeleton for the stack. Run detail, tasks, cases, and calibration are each worth their own card once m-5 has shown what the first screen taught us about the wiring; filing them now would be planning six screens against a design nobody has used yet.

What is left here is the pair that answers the product's own question: comparisons, and the corpus screen that says which recorded results an edit invalidated. Those two together are what m-7 is for.

Vocabulary: this card's labels, routes, and API shapes follow decision-5 and GLOSSARY.md — code/records/CLI keep run, stage, pipeline, case, attempt, rep, confirmation run; the design's task, step, and plural "attempts"/"group" are UI labels only, mapped in GLOSSARY.md.

Criteria conflict, noted 2026-09-07 before shaping. ACs #1 through #6 predate the 2026-09-04 triage that narrowed this card to comparisons and corpus. AC #1 names run history, which ACT-53 built and closed. AC #4 says 'every screen', which under the narrowed scope means these two. Shaping rewrites them against the two screens this card actually builds, per SPEC.md sections 5 (Comparisons) and 6 (Corpus). Not rewritten here, because the shaping stage decides what the criteria become.

ACT-104 (comparison spread as an interval with a per-measure reading verdict) is a backend gap feeding this card's comparison screen and carries no dependency link to it. Shaping decides whether it lands first, inside this card, or after.
<!-- SECTION:NOTES:END -->
