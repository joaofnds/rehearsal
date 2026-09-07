---
id: ACT-87
title: list runs prints raw ENOENT for a stopped run with no manifest
status: Done
assignee: []
created_date: '2026-09-05 23:09'
updated_date: '2026-09-07 13:27'
labels: []
dependencies: []
documentation:
  - doc-31
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
- [x] #1 rehearsal list runs on a checkout holding a stopped run with no manifest.json prints no raw ENOENT
- [x] #2 the missing-manifest case is reported as incomplete through the existing unreadable-record path, matching ACT-40 and ACT-85
- [x] #3 the control-root redaction test still fails when controlRelative is removed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape skipped 2026-09-07: the shape session found no design choice left and recommended going straight to build. This is the third instance of a fix pattern ACT-40 and ACT-85 already settled (check existence, throw a plain 'incomplete' reason through collect's unreadable path). Confirmed before build: list-command.ts already carries that exact reason shape at lines 200 and 260, both with no path in the text. The redaction test at list-command.test.ts:313 asserts the reason contains the manifest path, and today only the raw ENOENT supplies it, so following the precedent verbatim breaks that test. Criterion 3 is what forces it to be resolved rather than dropped.

Fix committed at ccba3e9. listRuns now catches loadRunManifest's own rejection at the call site and re-throws the 'incomplete: no manifest.json at <path>' shape, rather than adding a second existence check ahead of it (the architecture review's should-fix: duplicating loadRunManifest's own existence check would have left that check permanently unreachable on this call path; disposed by reusing it via .catch instead). Path stays in the message because the control-root redaction test needs a path-bearing reason on this code path.

Verified this session: full suite (mise exec -- bun test) 1088 pass, typecheck and lint clean, oxfmt clean. review-code pass ran five axes (spec, style, architecture, security, testing) in parallel; four reported no findings, one should-fix (architecture, duplicated existence check) fixed and re-verified.

The card's stated root cause ('reaches loadRunManifest with no existence check' causing a 'raw ENOENT') was stale: loadRunManifest already had its own existence check and friendly error before this task, unrelated to ACT-85. The real gap was narrower: listRuns didn't route that friendly error through collect's 'incomplete' reason shape, so it reached the operator as loadRunManifest's own wording instead of the ACT-40/ACT-85 pattern. Confirmed by a fresh test that failed exactly that way before the fix.

Nothing deferred. No follow-up card opened.
<!-- SECTION:NOTES:END -->
