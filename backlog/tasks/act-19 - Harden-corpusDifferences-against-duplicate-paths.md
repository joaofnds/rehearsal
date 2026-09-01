---
id: ACT-19
title: Harden corpusDifferences against duplicate paths
status: Build
assignee:
  - '@claude'
created_date: '2026-08-31 04:12'
updated_date: '2026-09-01 08:11'
labels: []
dependencies: []
references:
  - src/benchmark/checkpoint.ts
  - run-benchmark.test.ts
type: bug
ordinal: 11008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`corpusDifferences` in `src/benchmark/checkpoint.ts` deletes from its right-hand map while walking the left corpus. A repeated left-hand path therefore becomes spuriously missing on its second occurrence: `[a, a]` against `[a]` currently reports `a removed`.

`captureStageCorpus` produces unique paths today, but `corpusDifferences` is exported and its array-typed boundary does not enforce the path-keyed corpus invariant. Duplicate paths are invalid corpus data, including duplicates carrying the same hash. Reject them explicitly rather than assigning multiset or last-write-wins semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `corpusDifferences` given a duplicate path in its left corpus throws an error that names that path, even when both entries have the same hash.
- [ ] #2 `corpusDifferences` given a duplicate path in its right corpus throws an error that names that path, even when both entries have the same hash.
- [ ] #3 `corpusDifferences` retains the existing sorted modified, missing-from-right, and missing-from-left results for path-unique corpora.
- [ ] #4 `bun test`, `bun run typecheck`, `bun run lint`, and `bun run fmt:check` pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: make `corpusDifferences` enforce that each corpus contains at most one hashed file per path before comparing them.

Known starting point:
- The comparator maps the right corpus by path, then deletes matches while walking the left. Duplicate left paths therefore produce a false missing result; duplicate right paths are silently collapsed by `Map`.
- All current corpus producers are path-unique by construction: skill files receive `skills/<name>/` prefixes, and a global skill that is also stage-local is captured once.
- The comparator is shared by checkpoint staleness and attempt-lineage guards and is exported with plain readonly arrays, so the invariant is not represented by its type.

Resolved decisions:
1. Corpus file identity is its path. Duplicate paths are invalid input, whether their hashes agree or conflict; they are not repeated multiset members. João confirmed this on 2026-09-01.
2. Enforce uniqueness at the exported `corpusDifferences` boundary for each side before comparison. This protects both callers and direct consumers without broadening the task into persisted-record validation.
3. The failure names the duplicate path. Existing results and wording callbacks remain unchanged for valid path-unique inputs.
4. No glossary term is added: “Corpus (instruction corpus)” already names the domain concept, and this task only makes its path identity invariant explicit in code and tests.

Acceptance observations are the structured criteria above.

First test to write: call `corpusDifferences` with two identical left-hand entries for path `a` and one matching right-hand entry; expect an error naming `a`. Observe it fail because the function currently returns `["a removed"]`.
<!-- SECTION:PLAN:END -->
