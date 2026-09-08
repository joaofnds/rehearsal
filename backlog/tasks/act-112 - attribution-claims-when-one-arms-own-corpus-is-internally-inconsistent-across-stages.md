---
id: ACT-112
title: >-
  attribution claims when one arm's own corpus is internally inconsistent across
  stages
status: To Do
assignee: []
created_date: '2026-09-08 00:54'
labels: []
dependencies: []
ordinal: 108008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 comparisonAttribution's behavior when one arm's own executedCorpus carries two different hashes for the same layout path (corpus edited mid-run, between two stage snapshots) is a deliberate product decision, not silent first-hash-wins
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found during ACT-50's code review (Testing and Refactoring axes, both rated note/should-fix-adjacent, not blocking). src/server/comparison-attribution.ts's dedupedByPath keeps the first-seen hash per layout path within one arm's own executedCorpus and silently drops any later, differing hash for that same path. This means an arm whose corpus was edited between two of its own stages (a real possibility: snapshotStageCorpus reads live from disk per stage, and staleness-report.ts's deriveStaleness exists elsewhere to detect exactly this kind of mid-run drift) reports based on an arbitrary one of the two hashes, with no signal that the arm's own corpus was unstable. No test exercises this case; all four existing tests in comparison-attribution.test.ts use identical hashes per path within each side. Whether the right behavior is to refuse the attribution claim entirely, surface a distinct warning, or something else, is a product call this card does not make on its own.
<!-- SECTION:NOTES:END -->
