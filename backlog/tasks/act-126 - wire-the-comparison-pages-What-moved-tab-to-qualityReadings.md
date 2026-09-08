---
id: ACT-126
title: wire the comparison page's 'What moved' tab to qualityReadings
status: To Do
assignee: []
created_date: '2026-09-08 21:47'
updated_date: '2026-09-08 23:15'
labels: []
milestone: m-7
dependencies:
  - ACT-104
priority: medium
ordinal: 122008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GET /api/comparisons/:digest now serves a qualityReadings field (per case, per arm pair, per measure: an interval and a closed-set verdict), added by ACT-104. The comparison page's What moved tab still renders PlannedFeatureBlock (comparison-page.tsx:172-178), whose placeholder copy claims a paired estimate cannot supply the interval yet; that claim is now false. Filed from doc-47, the reflection on ACT-104, per m-7 (read a comparison and decide whether an edit helped). ACT-50 is not the right home: it is Done and its own text deliberately deferred this tab to ACT-104 by name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The What moved tab renders, per measure per case, the interval and verdict from qualityReadings instead of PlannedFeatureBlock
- [ ] #2 The tab is opened in a browser against a comparison recorded on disk and the rendered interval and verdict are confirmed to match the served qualityReadings field
- [ ] #3 The placeholder copy claiming a paired estimate cannot supply the interval is removed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-09: this card and ACT-50 AC#13 are the same work. Commit f835f75 (2026-09-08 23:49, by direction) reopened ACT-50 to To Do and added AC#13, 'The comparison page's What moved tab renders the per-measure interval and verdict the served report carries, replacing the PlannedFeatureBlock', for exactly this tab. ACT-126 was filed by doc-48 at 21:47, two hours before that direction landed, from doc-47's proposal.

This card's own body states 'ACT-50 is not the right home: it is Done'. That is now false: ACT-50 reads To Do, verified 2026-09-09. A seventh instance of the pattern ACT-127 holds.

Merge proposed on the triage doc, survivor ACT-50, since the direction named it. Not archived this run: the choice of survivor is the writer's, and the direction is two hours newer than the card.
<!-- SECTION:NOTES:END -->
