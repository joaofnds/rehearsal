---
id: ACT-126
title: wire the comparison page's 'What moved' tab to qualityReadings
status: To Do
assignee: []
created_date: '2026-09-08 21:47'
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
