---
id: ACT-74
title: the build stage's corpus files are not recorded
status: To Do
assignee: []
created_date: '2026-09-05 00:41'
updated_date: '2026-09-05 00:41'
labels: []
dependencies: []
type: bug
ordinal: 70008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-05 while preparing ACT-39's replay.

The shape stage's record and its checkpoint both carry a corpusFiles list, nine entries naming CLAUDE.md, agents/reviewer.md, output-styles/brief.md, and the doctrine and shape skills. The build stage's record at .benchmark-runs/2026-09-05T00-21-40.070Z.build.json has no corpusFiles key at all.

The consequence: an edit to a file the build stage read cannot invalidate anything, because nothing records that it read it. Editing skills/build/SKILL.md and running stale reported no checkpoint. Only editing CLAUDE.md, which the shape stage recorded, produced a staleness line.

Worth separating: the build stage's input.instructions holds the global CLAUDE.md and does not contain the build skill's text, so the build stage may genuinely not receive that skill. Either way the record cannot distinguish 'read it and we did not record it' from 'never read it', and both break the replay story for delivery stages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A build stage's record lists every corpus file the stage read, as the shape stage's record does
- [ ] #2 stale reports a checkpoint invalidated by an edit to a file the build stage read
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session running ACT-39's replay, which worked around it by editing CLAUDE.md instead. ACT-39's replay is of the shape stage for this reason.
<!-- SECTION:NOTES:END -->
