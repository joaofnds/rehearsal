---
id: ACT-91
title: list labels a stopped run not replayable when its checkpoints are usable
status: To Do
assignee: []
created_date: '2026-09-06 22:19'
updated_date: '2026-09-06 22:19'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 87008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stopped run whose manifest and stage checkpoints exist is listed as replayable (observed: run 2026-09-06T21-58-29.508Z, STOPPED:build, replayed its shape stage successfully while listed as not replayable)
- [ ] #2 A stopped run whose manifest and stage checkpoints exist is listed as replayable
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found 2026-09-06 while running the end-to-end replay check.

list-command.ts:153 returns the literal 'not replayable' for any run with a stopped stage. The line immediately above it, 151, successfully reads that run's manifest via loadRunManifest. The non-stopped branch at 137 decides replayability precisely by whether that manifest file exists. So the stopped branch has the evidence in hand and ignores it.

Observed on run 2026-09-06T21-58-29.508Z (audit-log, STOPPED:build). 'rehearsal list runs' calls it not replayable. Its manifest.json exists, and 'rehearsal list checkpoints' shows both an initial and a shape checkpoint with digests. A replay of its shape stage was started and did not refuse on the grounds of the run being stopped.

Cost: a stopped run is the case an operator most wants to replay. The stage graded badly, and the question is whether a corpus edit moves it. The label tells them the one run worth iterating on cannot be iterated on. The command still works if they ignore the label, which makes this a wrong signal rather than a broken feature.
<!-- SECTION:NOTES:END -->
