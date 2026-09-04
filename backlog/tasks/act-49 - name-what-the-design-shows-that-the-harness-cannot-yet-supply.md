---
id: ACT-49
title: name what the design shows that the harness cannot yet supply
status: To Do
assignee: []
created_date: '2026-09-04 13:01'
updated_date: '2026-09-04 13:10'
labels: []
milestone: m-4
dependencies:
  - ACT-47
priority: high
ordinal: 51008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The prototype presents data the harness does not record today. Until that gap is written down, every screen card is guessing at how much backend work it carries.

Observed on the run history screen, 2026-09-04:

- **A live run.** The top row reads "running, step 3 of 4" with a spend bar counting against a ceiling and a wall clock. Nothing streams today: the CLI writes a record when a stage finishes, and ACT-26.7 records that harness progress goes to stdout as prose. There is no event stream, no partial state on disk, and no way to read a run in flight.
- **A per-run cost that includes the judge.** The design shows one cost per run. ACT-43 records that the artifact carries only the workflow session cost and omits the judge entirely.
- **An interrupted run, reconciled.** One row reads "interrupted, spend ceiling reached mid-step 2". The harness has no interrupted outcome and nothing reconciles a partial run on restart. The lost UI had a startup-reconciliation module for exactly this (docs/recovered).
- **Staleness with a distance.** Rows say "stale, corpus changes since" and "superseded, 2 versions back". `rehearsal stale` answers the boolean today; it does not say how many corpus versions back a result sits.
- **A groups row.** One row reads "6 of 6 recorded, median B, range D to A". Confirmation groups exist in the harness; whether the record carries a median and a range in this shape is unverified.
- **Task-level grade separate from step grades.** Each row shows step grades and a task grade, with rows reading "graded independently". The harness has stage judges and a final judge, so this may map cleanly, but the mapping is not confirmed.

The three run-detail layouts (Step rail, Record ledger, Contribution) and the two comparison layouts (Attempt pairs, What moved) were not inspectable, so their data needs are unknown and this card does not claim to cover them.

This card produces the inventory, not the fixes. Each real gap becomes its own card, and the ones that are already cards (ACT-43 for judge cost, ACT-26.7 for the stdout rule) get referenced rather than duplicated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every screen in the committed design is walked, and each piece of data it displays is marked as recorded today, derivable from what is recorded, or not recorded at all
- [ ] #2 Each not-recorded item names the card that would supply it, existing or newly filed
- [ ] #3 The live-run gap states specifically what a UI would have to read to show a run in progress, since nothing on disk answers that today
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, after ACT-47 landed the export. This card was written from screenshots of one screen and says so ("the three run-detail layouts and the two comparison layouts were not inspectable"). docs/design-handoff/SPEC.md now specifies all nine screens in text, so the inventory can be complete rather than partial.

Gaps the spec names that this card could not see. Not a replacement for the card's own list, an addition to it:

- Judge cost per step, shown as "independent session · $0.08" in the judge pane. This is ACT-43, and the spec makes it visible rather than merely recorded, which raises its priority.
- A per-file read manifest per step, with each instruction file's ROLE: project instructions / step skill / judge rubric / read for context, plus its hash and whether it changed since the run. The harness records corpus files with hashes; the role classification does not exist.
- Cited evidence with a source kind (transcript / diff / instruction), a locator that opens the file (session.jsonl:1284, src/auth/tokens.ts +38 -12, skills/implement.md:43), and the quoted span itself. The spec stores only cited spans and links out for the rest.
- Contribution phrases per step ("brief the later steps read", "named 2 files to touch").
- Culprit analysis: an agent reading the recorded steps and naming a probable cause, carrying its own cost, duration, and timestamp, explicitly labeled as opinion rather than measurement. Does not exist in any form.
- Per-dimension judge drift ("judge +0.7 steps", "agrees") on the calibration screen. Judge-vs-human agreement accumulates from ACT-7; whether it resolves per dimension is unverified.
- Word count per attempt, shown beside cost in the comparison arm cards. The spec says this placement is deliberate: it is how verbosity gets caught.
- Wall-clock per run and per step.
- Checkpoint ids in the form ckpt-0148-s1.
- Spread across attempts rendered as an interval, and a "reading" verdict per measure (inside rerun noise / fires less often / clearest movement).

Two spec rules that constrain how a gap may be closed, worth carrying into the inventory:
- A task that stopped early is NOT gradable at task level. Show a dash with the reason, never a zero and never an error.
- An attribution claim is legitimate only when exactly one instruction file hash differs between arms. If more than one differs, the UI must say so and refuse the claim.
<!-- SECTION:NOTES:END -->
