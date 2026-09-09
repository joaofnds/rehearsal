---
id: ACT-112
title: >-
  attribution claims when one arm's own corpus is internally inconsistent across
  stages
status: To Do
assignee: []
created_date: '2026-09-08 00:54'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: low
ordinal: 108008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refuse or explicitly qualify attribution when one arm records multiple hashes for the same corpus path across stages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 comparisonAttribution's behavior when one arm's own executedCorpus carries two different hashes for the same layout path (corpus edited mid-run, between two stage snapshots) is a deliberate product decision, not silent first-hash-wins
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found during ACT-50's code review (Testing and Refactoring axes, both rated note/should-fix-adjacent, not blocking). src/server/comparison-attribution.ts's dedupedByPath keeps the first-seen hash per layout path within one arm's own executedCorpus and silently drops any later, differing hash for that same path. This means an arm whose corpus was edited between two of its own stages (a real possibility: snapshotStageCorpus reads live from disk per stage, and staleness-report.ts's deriveStaleness exists elsewhere to detect exactly this kind of mid-run drift) reports based on an arbitrary one of the two hashes, with no signal that the arm's own corpus was unstable. No test exercises this case; all four existing tests in comparison-attribution.test.ts use identical hashes per path within each side. Whether the right behavior is to refuse the attribution claim entirely, surface a distinct warning, or something else, is a product call this card does not make on its own.

Triage 2026-09-08 (e): citation drift only. comparison-attribution.test.ts now has five it() tests, not four as the card states. Substance unchanged: all use identical hashes per path within each side; the differing-hash-within-one-arm case is still untested.

Part of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.

Probed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.

Low, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: low. Silent first-hash-wins can make attribution confident over unstable evidence, but the desired product behavior is not settled.

Evidence: comparison-attribution.ts dedupedByPath keeps the first hash; all five focused tests use internally consistent hashes.

Unresolved claims/resources: Refuse-versus-warning behavior is unset.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Choose a distinct refusal naming the unstable arm/path, then add the differing-hash-within-one-arm test.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
