---
id: ACT-150
title: >-
  an unreadable or looping file inside a corpus layout directory still 500s the
  corpus screen
status: To Do
assignee: []
created_date: '2026-09-09 15:51'
updated_date: '2026-09-09 15:52'
labels: []
dependencies: []
type: bug
ordinal: 146008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corpusReport on a directory source whose agents/ holds a file that cannot be read returns a refusal naming that file and no digest, rather than throwing EACCES (reproduced 2026-09-09 on ACT-137: corpusReport THREW EACCES 'permission denied, lstat ...' before returning any report)
- [ ] #2 corpusReport on a directory source whose agents/ holds a symlink pointing at itself returns a refusal naming that file and no digest, rather than throwing ELOOP (reproduced 2026-09-09 on ACT-137: corpusReport THREW ELOOP 'too many symbolic links encountered')
- [ ] #3 GET /api/corpus in both states returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)
- [ ] #4 the live corpus report is unchanged at 122 files, digest c7000b, zero refusals (measured 2026-09-09 on ACT-137, as a regression guard)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by ACT-137's after-task pass, 2026-09-09, and reproduced by that session rather than reasoned about.

ACT-137 fixed these states for the INSTRUCTION FILE only: a CLAUDE.md that is unreadable, loops, dangles, names a directory, or leaves the root is now a named refusal in a 200 report. The same states inside a layout directory (agents/, output-styles/, rulebook/) still throw out of walkDirectory and reach app.onError as a 500.

The structural finding underneath: 'how a corpus entry fails to be hashable' is now knowledge encoded in two places. src/benchmark/checkpoint.ts refuses two states in its walk (an entry resolving outside the tree, a link whose target is missing) and src/server/corpus-report.ts refuses five for the instruction file. The walk's two are a subset. Whoever takes this should consider whether the walk grows the missing three or whether both sides read one shared classifier, rather than adding a third copy.

Wording to match, so the screen speaks with one voice: checkpoint.ts:101 owns 'is a link whose target is missing, so the bytes it names cannot be read' and corpus-report.ts reuses that sentence for the same condition. ACT-137 gave ELOOP its own wording ('is a link that never resolves to a file, so it names no bytes') because the dangling sentence is false for a loop: the target exists and following it is what does not end.

Note that walkDirectory returns refusals as a LIST and corpusReport already maps them into the report, so the layout half may be a smaller change than the instruction half was: the plumbing exists, the classification does not.
<!-- SECTION:NOTES:END -->
