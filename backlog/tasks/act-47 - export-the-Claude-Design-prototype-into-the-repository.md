---
id: ACT-47
title: export the Claude Design prototype into the repository
status: To Do
assignee: []
created_date: '2026-09-04 13:00'
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
- [ ] #1 Rehearsal.dc.html and support.js are committed in this repository and open in a browser from a local checkout
- [ ] #2 Every one of the nine screens is reachable in the committed copy
- [ ] #3 The commit message records where the file came from and that it is a design reference rather than shipped code
<!-- AC:END -->
