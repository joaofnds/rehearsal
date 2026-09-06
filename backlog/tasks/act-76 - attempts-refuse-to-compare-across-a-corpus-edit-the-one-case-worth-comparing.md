---
id: ACT-76
title: 'attempts refuse to compare across a corpus edit, the one case worth comparing'
status: To Do
assignee: []
created_date: '2026-09-05 01:49'
updated_date: '2026-09-06 13:26'
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
<!-- SECTION:NOTES:END -->
