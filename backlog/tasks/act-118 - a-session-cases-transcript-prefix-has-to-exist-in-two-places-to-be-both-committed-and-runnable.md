---
id: ACT-118
title: >-
  a session case's transcript prefix has to exist in two places to be both
  committed and runnable
status: To Do
assignee: []
created_date: '2026-09-08 11:55'
updated_date: '2026-09-08 20:41'
labels: []
dependencies: []
priority: medium
ordinal: 114008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A session case that declares a transcript prefix needs the same bytes in two locations, and only one of them is committable.

The harness resolves the prefix at run time under .benchmark-runs/cases/<case-id>/<file>, which .gitignore line 2 excludes as run state. The error when it is absent says so: 'The prefix bytes are git-ignored run state; recapture them with rehearsal case capture.' But ACT-59's AC#7 requires the fixture to be committed, and its test (src/benchmark/context-manifest.test.ts:149) reads it from casesRoot(), i.e. cases/<case-id>/<file>.

Observed 2026-09-08 with the manifest-probe case: the fixture committed under cases/manifest-probe/ satisfies the test, but `rehearsal run --case manifest-probe` refuses to start until the same file is copied to .benchmark-runs/cases/manifest-probe/. It runs here only because that copy was made by hand and is not in git, so a fresh clone cannot run the case.

The two consumers disagree about where a prefix lives. Deciding which location is authoritative is the work: either the runtime also accepts a committed prefix under cases/, or committed fixtures are declared some other way and the test stops reading casesRoot(). Related to ACT-116, which is why `case capture` could not produce the file in the first place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session case with a committed transcript prefix runs from a fresh clone with no file copied by hand
- [ ] #2 The AC#7 manifest fixture test and the harness runtime read the prefix from the same declared location
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-08 (e): citation error. context-manifest.test.ts:149 is an unrelated test; the actual casesRoot() read the card means is at line 227-228. .gitignore line 2 and the session-attempt.ts:173 error message are correctly cited.
<!-- SECTION:NOTES:END -->
