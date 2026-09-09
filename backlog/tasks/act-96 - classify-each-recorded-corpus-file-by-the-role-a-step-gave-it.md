---
id: ACT-96
title: classify each recorded corpus file by the role a step gave it
status: To Do
assignee: []
created_date: '2026-09-07 16:28'
updated_date: '2026-09-09 16:22'
labels: []
dependencies:
  - ACT-49
priority: low
ordinal: 92008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's step modal shows each instruction file a step loaded with a ROLE (project instructions / step skill / judge rubric / read for context) alongside its path and hash. The harness records corpus files today as HashedFile (path + sha256 only, corpus-file.ts:14) with no role field anywhere in the pipeline. ACT-59/ACT-61 add project-half vs corpus-half distinction to the context manifest, which is coarser than this four-way classification and does not by itself supply it. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A recorded attempt names, for each corpus file it loaded, one of: project instructions, step skill, judge rubric, read for context
- [ ] #2 The classification is checked against a real run's recorded files, not asserted from the pipeline definition alone
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-08 (d): citation error, substance unaffected. Card cites 'HashedFile (path + sha256 only, corpus-file.ts:14)'. Verified 2026-09-08: HashedFile is defined at src/benchmark/checkpoint.ts:13; corpus-file.ts has no such interface. The claim that no role field exists on it is still correct.

Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. File roles would make the step modal auditable, but the record must distinguish declared role from observed use before implementation.

Evidence: HEAD 1d02c8e: HashedFile is path+sha256 and an src/client search found no per-file role field; ACT-49 is Done.

Unresolved claims/resources: Role provenance semantics are unset.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Define declared-versus-observed role semantics and add real-run acceptance.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
