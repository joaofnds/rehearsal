---
id: ACT-19
title: Harden corpusDifferences against duplicate paths
status: To Do
assignee: []
created_date: '2026-08-31 04:12'
labels: []
dependencies: []
ordinal: 11008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/benchmark/checkpoint.ts corpusDifferences deletes from its right-hand map as it walks the left side, so a path appearing twice in the left argument reports a spurious difference on the second occurrence. Verified: corpusDifferences([{a,h},{a,h}], [{a,h}], wording) returns ['a removed'], meaning two identical corpora read as differing.

Not reachable today: captureStageCorpus prefixes each skill's files with skills/<name> and hashes a global-equals-own skill once, so paths are unique by construction. The function is exported and shared by the staleness derivation and the attempt comparison guard, and its contract does not state that inputs must be path-unique.

Fix: either state and enforce the uniqueness precondition, or count occurrences per path rather than deleting on first match.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corpusDifferences reports no difference between two identical corpora that contain a duplicated path
- [ ] #2 The path-uniqueness expectation is either enforced or documented at the function's boundary
<!-- AC:END -->
