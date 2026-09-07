---
id: ACT-96
title: classify each recorded corpus file by the role a step gave it
status: To Do
assignee: []
created_date: '2026-09-07 16:28'
labels: []
dependencies:
  - ACT-49
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
