---
id: ACT-29
title: delete the temporary directories the test suite creates
status: To Do
assignee: []
created_date: '2026-09-03 00:32'
updated_date: '2026-09-04 00:54'
labels: []
dependencies: []
priority: medium
ordinal: 31008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Most test suites make their scratch directories with mkdtemp directly and never remove them, so every `bun test` run leaves hundreds behind in $TMPDIR. Observed 2026-09-03 during ACT-26.6: 817 rehearsal-attempt-record, 817 rehearsal-attempt-projects, 676 rehearsal-projects, 670 rehearsal-confirmation-failures, and more, over 1500 in total. TestResources.forEachTest() already exists and cleans up; the suites that predate it do not use it. The fix is mechanical, per file: take the directory from resources.createControlDirectory() or track() what mkdtemp returned. Found by ACT-26.6, whose own new leak (the chezmoi render, a copy of the home tree) it fixed in place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun test leaves no rehearsal-* directory behind in $TMPDIR: a test asserts the count is unchanged across a suite run, or the suites are converted and the count is observed to be zero
- [ ] #2 Every suite that creates a temporary directory removes it, whether the test passed or threw
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: the description counts over 1500 leaked directories in $TMPDIR. `ls /tmp | grep -c '^rehearsal-'` now returns 210, because /tmp was cleaned since the observation. The leak itself is unchanged and confirmed: 45 files under src/ call mkdtemp, while 24 reference TestResources.

Per decision-1, the counts with their commands, on 2026-09-03: `ls $TMPDIR | grep -c '^rehearsal-'` returns 210 (the leak's visible size, which a /tmp clean resets and which therefore says nothing about progress); `grep -rln 'mkdtemp' src/ | wc -l` returns 45 and `grep -rln 'TestResources' src/ | wc -l` returns 24 (the work's actual size, which only this card's fix changes). Prioritize on the second pair.

Triage 2026-09-04: re-run. The work's size is unchanged: `grep -rln 'mkdtemp' src/ | wc -l` returns 45, `grep -rln 'TestResources' src/ | wc -l` returns 24.

The visible leak grew from 210 to 1075 in one day (`ls /tmp | grep -c '^rehearsal-'`), which is the rate this triage's own suite runs produced. That number is not progress evidence, per the note above, but the rate is: roughly 865 directories per day of ordinary work on this repository.
<!-- SECTION:NOTES:END -->
