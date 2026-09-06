---
id: ACT-76
title: 'attempts refuse to compare across a corpus edit, the one case worth comparing'
status: Build
assignee: []
created_date: '2026-09-05 01:49'
updated_date: '2026-09-06 13:28'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 72008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Observed 2026-09-05, on the first real replay against an edited corpus.

A replay of the shape stage against a corpus whose CLAUDE.md carried one added paragraph printed: 'Cannot compare original run 2026-09-05T00-21-40.070Z with replay 2026-09-05T01:48:05.794Z: they consumed different inputs (CLAUDE.md differs)'. Both attempts were read by hand instead.

The refusal is in assertComparableLineages, src/benchmark/attempts.ts:271-291. Its comment states the reason: 'Grades from different corpora measure different things, so a side-by-side presentation of them would mislead rather than inform.'

That reasoning holds for a model or effort change and inverts for a corpus edit. Whether an instruction change moved a stage's grade is the question this tool exists to answer, and today the comparison declines exactly when the corpus differs, which is the only case worth comparing.

lineageDifferences (attempts.ts:240-262) builds one flat list from model, effort, and corpus files, and the caller refuses on any entry. So a corpus edit is treated the same as a model swap. The fix is to separate them: a differing model or effort still refuses, a differing corpus is the comparison's subject and is named in the presentation rather than blocking it.

The cost is concrete. ACT-39 asks whether an edit improved a stage, answered from the tool's own output. Today that question can only be answered by reading two JSON records by hand, which is what this session did.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two attempts on the same stage that differ only in corpus files are presented side by side, with the differing files named
- [ ] #2 Two attempts that differ in model or effort are still refused
- [ ] #3 A replay against an edited corpus prints the comparison against its baseline without a second command
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the iterate session that made replay accept a corpus source (ACT-75). The replay itself worked: the record hashes the edited CLAUDE.md (f16dd9dc) rather than the live one (a29fbbc0), so the corpus was genuinely delivered. Only the comparison step refused.

2026-09-06, reproduced before shaping. Drove presentAttempts directly with two constructed attempt pairs.

Corpus-only difference (same model, same effort, CLAUDE.md sha aaa against bbb): REFUSED, 'Cannot compare original with replay: they consumed different inputs (CLAUDE.md differs)'.

Model-only difference (sonnet against opus, identical corpus): REFUSED, 'model sonnet against opus'.

So both take the same path today, confirming the card. Criterion #2's behavior (refuse on model) already holds; criterion #1's (present on corpus) does not.

Shaped 2026-09-06.

Goal: a corpus-only difference between two attempts is shown side by side with the differing files named; a model or effort difference still refuses.

Approach (only one surveyed; the split is forced by the existing code shape, not chosen among alternatives): assertComparableLineages currently throws LineageMismatchError on any entry lineageDifferences returns, mixing model/effort with corpus paths. Split the check: keep throwing on model/effort disagreement between the reference and any other labelled attempt (criterion #2, already passes today per the reproduction below). Compute corpus differences separately via corpusDifferences (checkpoint.ts) with a new wording table (COMPARISON_WORDING already exists and is close; may need reuse or a small variant) and pass them into presentAttempts to render as a line naming the differing files, never as a throw (criterion #1). Criterion #3 falls out of #1 once replay-command.ts's attemptComparison stops hitting the LineageMismatchError branch for corpus-only cases.

No unknowns sent to João: the fix is mechanical and the design is already implied by the file's existing separation of concerns (COMPARISON_WORDING vs STALENESS_WORDING tables, lineageDifferences already computing model/effort and corpus separately before concatenating them).

First test to write: extend attempts.test.ts's presentAttempts describe block with a case of two attempts differing only in corpusFiles (same model/effort) and assert the output names the differing path and does not throw. Pair it with one asserting a model-only difference still throws (criterion #2's existing coverage should already cover this; confirm it's there before adding a duplicate).

Acceptance criteria carried forward unchanged from the original card (already observational).

Review (2026-09-06) found the plan understated the change: lineageDifferences today concatenates model/effort and corpus differences into one throwable list (attempts.ts:254-260), so separating them is a rewrite of that function's contract and of assertComparableLineages's control flow, not a pure split of already-separate data. Build should treat this as the real shape of the work.

Two gaps closed here so build isn't guessing:

Output wording/placement: one line after the checkpoint header in presentAttempts naming the differing corpus files, reusing COMPARISON_WORDING as-is (e.g. "CLAUDE.md differs") rather than a new wording table. This is a presentation choice with nothing external forcing a different answer, so it's decided here rather than sent to João.

Legacy attempts with no lineageInputs: assertComparableLineages already skips unlabelled attempts (attempts.ts:272-279) and existing tests (attempts.test.ts:203-214, 407-418) lock in that a legacy attempt is presented with no lineage note at all. The fix leaves that untouched: only pairs where both sides carry lineageInputs get the new corpus-naming line. Nothing on the card asks for legacy attempts to gain a corpus note they don't have the data for.

No open question for João: both gaps had a decidable answer from existing code conventions and test-locked behavior, not a João-level tradeoff.
<!-- SECTION:NOTES:END -->
