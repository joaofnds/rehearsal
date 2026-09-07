---
id: ACT-87
title: list runs prints raw ENOENT for a stopped run with no manifest
status: Build
assignee: []
created_date: '2026-09-05 23:09'
updated_date: '2026-09-07 13:18'
labels: []
dependencies: []
ordinal: 83008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Third instance of the defect class ACT-40 and ACT-85 closed, in listRuns in src/cli/list-command.ts. A run with no artifact file that has a stopped stage reaches loadRunManifest(paths.manifestFile) with no existence check, so a stopped run whose manifest was never written throws a raw ENOENT that reaches the operator verbatim.

Confirmed by reading the code at src/cli/list-command.ts:152, and reachable today: ACT-85's review relocated the control-root redaction test onto exactly this path, via the writeStoppedRunWithoutManifest fixture, because ACT-85's fix removed the path-bearing reason that test used to rely on. That test asserts the reason names a path relative to the control root, so it passes on the raw ENOENT and does not object to it.

Fix shape is the same as the previous two: check existence first, throw a plain 'incomplete' reason routed through collect's existing unreadable path. Note that changing the reason will require the redaction test to find a third source of a path-bearing reason, or to assert on the new reason's path instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rehearsal list runs on a checkout holding a stopped run with no manifest.json prints no raw ENOENT
- [ ] #2 the missing-manifest case is reported as incomplete through the existing unreadable-record path, matching ACT-40 and ACT-85
- [ ] #3 the control-root redaction test still fails when controlRelative is removed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape skipped 2026-09-07: the shape session found no design choice left and recommended going straight to build. This is the third instance of a fix pattern ACT-40 and ACT-85 already settled (check existence, throw a plain 'incomplete' reason through collect's unreadable path). Confirmed before build: list-command.ts already carries that exact reason shape at lines 200 and 260, both with no path in the text. The redaction test at list-command.test.ts:313 asserts the reason contains the manifest path, and today only the raw ENOENT supplies it, so following the precedent verbatim breaks that test. Criterion 3 is what forces it to be resolved rather than dropped.
<!-- SECTION:NOTES:END -->
