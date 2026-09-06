---
id: ACT-76
title: 'attempts refuse to compare across a corpus edit, the one case worth comparing'
status: Done
assignee: []
created_date: '2026-09-05 01:49'
updated_date: '2026-09-06 13:40'
labels: []
milestone: m-1
dependencies: []
documentation:
  - backlog/docs/doc-25 - reflection-ACT-76.md
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
- [x] #1 Two attempts on the same stage that differ only in corpus files are presented side by side, with the differing files named
- [x] #2 Two attempts that differ in model or effort are still refused
- [x] #3 A replay against an edited corpus prints the comparison against its baseline without a second command
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed and committed (1ed1d0d). Split assertComparableLineages's single
refusal path into executionDifferences (model/effort, still throws
LineageMismatchError) and corpusLineageDifferences (corpus files, now
printed as lines in presentAttempts's output instead of thrown), sharing
a new lineagePairs helper for the reference-plus-later-attempts
traversal.

Review (six axes) found two real defects beyond the shaped plan, both
fixed in the same commit before this was called done:
- Corpus differences from three or more attempts collapsed into one
  deduplicated, unattributed line, so two replays editing the same file
  could not be told apart, or shown as both having touched it. Fixed by
  attributing each difference to the attempt that carries it. Verified
  by reverting the fix and confirming the new test fails with the exact
  collapse described.
- assertComparableLineages and the first-draft corpusLineageDifferences
  duplicated the same "filter to labelled attempts, take reference,
  iterate rest" logic verbatim. Extracted into lineagePairs.

Acceptance criteria checked, all with test evidence: #1 (corpus-only
difference presented with files named, including the added/removed-file
wording path, not just modified), #2 (model or effort difference still
refuses, including when the corpus also differs), #3 (replay-command.ts
already only catches LineageMismatchError, so the corpus-only case now
reaches its one existing presentAttempts call as ordinary output; no
second command).

Not built: a CLI-level end-to-end test driving runReplayCommand through
a real replay to observe AC3 at that layer. attemptComparison is a
four-line pass-through with no branching beyond the unchanged
LineageMismatchError catch, already proven by the attempts.ts unit and
loadAttempts-integration tests; a full session-execution test harness
for this would be disproportionate scaffolding for a boundary with no
new logic. If a future session wants that layer covered, the fixture in
replay-command.test.ts's "--corpus on a stage replay" describe block is
the nearest existing pattern to extend.

Verified: full suite (1060 pass, 0 fail), typecheck, lint, format, all
clean this session.

Independently verified after the build session, 2026-09-06, using the same probe that reproduced the defect before shaping.

Corpus-only difference: now PRESENTED, with 'replay: CLAUDE.md differs' naming the attempt that changed it, followed by both attempts' grades.
Model-only difference: still REFUSED, 'model sonnet against opus'.

Criterion #3 read at the source rather than tested end to end: replay-command.ts:193 calls presentAttempts inline and returns its output, catching only LineageMismatchError. So a corpus-differing replay prints the comparison in the same command. The build session's call not to build CLI scaffolding for this four-line pass-through is sound.

Full suite 1060 pass / 0 fail, up from 1057.
<!-- SECTION:NOTES:END -->
