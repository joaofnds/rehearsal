---
id: ACT-47
title: export the Claude Design prototype into the repository
status: Done
assignee: []
created_date: '2026-09-04 13:00'
updated_date: '2026-09-04 13:10'
labels: []
milestone: m-4
dependencies: []
priority: high
ordinal: 49008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design exists only as a hosted artifact at https://claude.ai/design/p/2bff721b-86ff-4429-b6a5-fe096e06844b (file Rehearsal.dc.html, plus support.js). It is served from a cross-origin frame, so a session cannot read its source or drive its screens: fetching the file from claudeusercontent.com fails and contentDocument is null. Verified 2026-09-04.

Nothing can be implemented from a screenshot. This card gets the source into git, where it becomes the reference every other m-4 card builds against, and where it survives the way the last UI did not.

Two routes. Either the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) is connected to a session and used to import the project, or Joao exports or copies the file out of Claude Design by hand. The MCP is not connected to any session as of 2026-09-04.

Land it under docs/design/ as the artifact it is, not under src/. It is a prototype to read, not code to ship.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rehearsal.dc.html and support.js are committed in this repository and open in a browser from a local checkout
- [x] #2 Every one of the nine screens is reachable in the committed copy
- [x] #3 The commit message records where the file came from and that it is a design reference rather than shipped code
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done 2026-09-04. Joao exported the project from Claude Design by hand (Rehearsal-handoff.zip), which was the second of the two routes this card names; the MCP route was never needed.

Landed at docs/design-handoff/: SPEC.md, prototype.html, support.js, and a README stating what each is for. SPEC.md is the export's own 44 KB written specification, which this card did not anticipate and which is more useful than the prototype: it carries the design tokens, the per-screen layout, the three product rules, and the accessibility requirements as text.

Observed directly, all nine screens, by serving the directory and clicking each nav item in a browser: Run history (the full durable-records table, including a stopped run, an interrupted one, a group, and rows marked stale and superseded), Live monitor (task graph, spend band with the striped ceiling meter, session pane, judge pane), Run detail (step rail layout, with the attempts-at-checkpoint list and the instructions-this-step-read table), Comparisons (attempt pairs, with the baseline arm and the what-the-pairing-says card), Corpus (file table plus the dashed PLANNED edit block), Tasks, Cases, Calibration, Settings. Both files return 200 from the local copy.

One correction, because it nearly cost the reference. The first commit dropped support.js, reasoning that SPEC.md says not to port the design environment's runtime. That was wrong: the prototype's markup is custom elements the runtime expands, so without it the file renders nothing. Restored in 849bec0, with the do-not-port rule moved into the directory's README where someone choosing what to import would read it.

Commits: bab2b17 (vendor), 849bec0 (restore the runtime).
<!-- SECTION:NOTES:END -->
