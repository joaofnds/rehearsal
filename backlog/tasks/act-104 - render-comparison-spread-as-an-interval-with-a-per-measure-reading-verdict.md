---
id: ACT-104
title: render comparison spread as an interval with a per-measure reading verdict
status: To Do
assignee: []
created_date: '2026-09-07 16:29'
labels: []
dependencies:
  - ACT-49
ordinal: 100008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design's 'What moved' comparison layout shows, per measure, a spread across attempts as an ASCII interval (arms overlap by 2 steps) and a glyph-plus-phrase reading (inside rerun noise / fires less often / clearest movement). comparison-quality.ts's QualityContrastEstimate carries paired successRate and passK estimates per contrast; nothing renders or computes an interval representation or a categorical reading verdict from them. Filed from ACT-49's design-vs-harness inventory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison report states, per measure, a spread across attempts in a form a UI can render as an interval
- [ ] #2 A comparison report states, per measure, one of a small fixed set of reading verdicts derived from that spread
<!-- AC:END -->
