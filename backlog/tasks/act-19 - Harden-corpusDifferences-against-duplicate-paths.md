---
id: ACT-19
title: Harden corpusDifferences against duplicate paths
status: Done
assignee:
  - '@claude'
created_date: '2026-08-31 04:12'
updated_date: '2026-09-01 08:31'
labels: []
dependencies: []
references:
  - src/benchmark/checkpoint.ts
  - run-benchmark.test.ts
modified_files:
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
- [x] #1 `corpusDifferences` given a duplicate path in its left corpus throws an error that names that path, even when both entries have the same hash.
- [x] #2 `corpusDifferences` given a duplicate path in its right corpus throws an error that names that path, even when both entries have the same hash.
- [x] #3 `corpusDifferences` retains the existing sorted modified, missing-from-right, and missing-from-left results for path-unique corpora.
- [x] #4 `bun test`, `bun run typecheck`, `bun run lint`, and `bun run fmt:check` pass.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build handoff (2026-09-01)

Changed:
- `corpusDifferences` now asserts path uniqueness independently for its left and right corpora before comparing them. Duplicate entries throw `Duplicate corpus path: <path>`, including equal-hash duplicates.
- Public-API tests cover duplicate paths on both sides and characterize the existing sorted modified, removed, and added result for valid corpora.
- Commits: `bd6c059` rejects duplicate left paths, `324229b` rejects duplicate right paths, and `7fee512` characterizes path-unique output.

Available but not wired / old path:
- None. Checkpoint staleness and attempt-lineage comparison already call `corpusDifferences`, so both receive the guard. No caller remains on an old traversal.

Observed:
- Red, left: `rejects a duplicate path in the left corpus` received `["a removed"]` and did not throw. After `bd6c059`, it passed.
- Red, right: `rejects a duplicate path in the right corpus` received `[]` and did not throw. After `324229b`, both duplicate-side tests passed.
- Characterization: the valid-corpus test passed on its first run with `["a changed", "b removed", "c added"]`, preserving existing behavior.
- Focused `bun test --test-name-pattern "corpusDifferences"`: 3 pass, 0 fail.
- Full `bun test`: 306 pass, 0 fail, 610 expectations. `bun run typecheck`, `bun run lint`, `bun run fmt:check`, and `git diff --check HEAD~3..HEAD` completed successfully.
- Direct `bun -e` invocation printed `left: Duplicate corpus path: a`, `right: Duplicate corpus path: a`, and `valid: ["a changed","b removed","c added"]`.

Not verified:
- No paid benchmark run was executed; the changed behavior is the exported deterministic comparator and was observed directly.

Stopped work:
- The first red attempt exposed a missing value import in the new test setup (`ReferenceError: corpusDifferences is not defined`). The import was corrected before observing the behavioral red; no production defect was involved.

Refactor and review:
- The refactor pass found no wider structural opportunity; the local uniqueness assertion centralizes the new invariant without changing callers.
- Independent review is not due: the change is an internal, reversible pure-function guard and is not outward-facing, irreversible, or security-surfaced. Author-side style, architecture, security, specification, testing, and refactoring checks found no remaining issue.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`corpusDifferences` now rejects duplicate paths on either input side before comparison and names the invalid path, while path-unique modified, removed, added, and sorted results remain unchanged. Direct execution observed both rejection branches and valid output; all 306 tests, typecheck, lint, format, and diff checks passed. No independent review trigger applies.
<!-- SECTION:FINAL_SUMMARY:END -->
