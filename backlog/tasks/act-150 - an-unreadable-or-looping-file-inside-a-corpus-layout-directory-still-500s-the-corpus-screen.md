---
id: ACT-150
title: >-
  an unreadable or looping file inside a corpus layout directory still 500s the
  corpus screen
status: Shape
assignee: []
created_date: '2026-09-09 15:51'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: medium
type: bug
ordinal: 146008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn unhashable files inside corpus layout directories into named refusals and a 200 corpus report, using the same classification as the instruction file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corpusReport on a directory source whose agents/ holds a file that cannot be read returns a refusal naming that file and no digest, rather than throwing EACCES (reproduced 2026-09-09 on ACT-137: corpusReport THREW EACCES 'permission denied, lstat ...' before returning any report)
- [ ] #2 corpusReport on a directory source whose agents/ holds a symlink pointing at itself returns a refusal naming that file and no digest, rather than throwing ELOOP (reproduced 2026-09-09 on ACT-137: corpusReport THREW ELOOP 'too many symbolic links encountered')
- [ ] #3 GET /api/corpus in both states returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)
- [ ] #4 A controlled healthy live fixture with legitimate links into its declared backing tree retains the same file identities and zero refusals after the change; compare the actual local live file set before/after within one run without pinning a mutable digest (original live-report regression intent; decision-4; doc-60 and doc-61 stale-digest verification)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by ACT-137's after-task pass, 2026-09-09, and reproduced by that session rather than reasoned about.

ACT-137 fixed these states for the INSTRUCTION FILE only: a CLAUDE.md that is unreadable, loops, dangles, names a directory, or leaves the root is now a named refusal in a 200 report. The same states inside a layout directory (agents/, output-styles/, rulebook/) still throw out of walkDirectory and reach app.onError as a 500.

The structural finding underneath: 'how a corpus entry fails to be hashable' is now knowledge encoded in two places. src/benchmark/checkpoint.ts refuses two states in its walk (an entry resolving outside the tree, a link whose target is missing) and src/server/corpus-report.ts refuses five for the instruction file. The walk's two are a subset. Whoever takes this should consider whether the walk grows the missing three or whether both sides read one shared classifier, rather than adding a third copy.

Wording to match, so the screen speaks with one voice: checkpoint.ts:101 owns 'is a link whose target is missing, so the bytes it names cannot be read' and corpus-report.ts reuses that sentence for the same condition. ACT-137 gave ELOOP its own wording ('is a link that never resolves to a file, so it names no bytes') because the dangling sentence is false for a loop: the target exists and following it is what does not end.

Note that walkDirectory returns refusals as a LIST and corpusReport already maps them into the report, so the layout half may be a smaller change than the instruction half was: the plumbing exists, the classification does not.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. Unreadable and looping layout entries can still fail the whole corpus screen; one shared classifier should prevent a third divergent error vocabulary.

Evidence: walkDirectory classifies outside/dangling links only; instruction entry handling classifies ELOOP/EACCES/EPERM and non-files. Focused suite expects unreadable layout failure today. Fresh corpus-probes.ts returned HTTP 500 for EACCES and ELOOP in a live agents directory; healthy live state was 122 files, digest 723012, no refusals.

Unresolved claims/resources: Shared entry-failure classifier boundary needs a short design pass.

Next action: Extract or share failure classification, return named layout refusals with no digest, and test synthetic ELOOP plus platform-capable unreadable cases; use before/after live equivalence instead of a literal digest.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
