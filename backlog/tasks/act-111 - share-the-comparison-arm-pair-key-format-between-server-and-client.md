---
id: ACT-111
title: share the comparison arm-pair-key format between server and client
status: Done
assignee: []
created_date: '2026-09-08 00:39'
updated_date: '2026-09-08 00:54'
labels: []
dependencies: []
ordinal: 107008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 comparison-page.tsx's armPairLabel and comparisons.ts's pairKey/armPairLabel agree on the Minus-separator and casing rule through one shared definition, not two independently written copies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found during ACT-50's after-task pass. src/server/comparisons.ts encodes an arm pair as `${minuend}Minus${Capitalize(subtrahend)}` (pairKey) and can decode it back (armPairLabel, added and tested in that commit). client/src/comparison/comparison-page.tsx needs the same decode to render the attribution card's pair label, but cannot import #server/comparisons directly: that module pulls in #benchmark/checkpoint and other server-only code through comparison-attribution.ts, which does not belong in the client bundle. The client currently carries its own copy of the same split-on-Minus logic (comparison-page.tsx's local armPairLabel), so the two sides must agree on an undocumented string convention with nothing enforcing it. No shared/isomorphic module directory exists in this repo today (checked 2026-09-08: only src/benchmark, src/cli, src/server); creating one is a bigger architectural decision than a same-task fix, so this was filed rather than done inline.

Fixed during ACT-50's code review, not by this card. The review's own Architecture axis disputed the original disposition (a card, not code): armPairLabel/pairKey have zero real dependencies of their own, so extracting them into a new module (src/server/comparison-arm-pair.ts, which imports only ComparisonArm's type from #benchmark/comparison-record, erased at compile time) let the client import the real function directly instead of duplicating it. Verified via mise exec -- bun run build:client and grep over the built bundle for node:crypto/node:fs: zero matches, confirming no Node-only code leaked into the client. client/src/comparison/comparison-page.tsx now imports armPairLabel from #server/comparison-arm-pair; its own duplicate copy is deleted.
<!-- SECTION:NOTES:END -->
