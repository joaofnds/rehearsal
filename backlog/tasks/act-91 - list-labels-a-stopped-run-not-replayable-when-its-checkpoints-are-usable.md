---
id: ACT-91
title: list labels a stopped run not replayable when its checkpoints are usable
status: Build
assignee:
  - '@claude'
created_date: '2026-09-06 22:19'
updated_date: '2026-09-07 12:34'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 87008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stopped run whose manifest and stage checkpoints exist is listed as replayable (observed: run 2026-09-06T21-58-29.508Z, STOPPED:build, replayed its shape stage successfully while listed as not replayable)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found 2026-09-06 while running the end-to-end replay check.

list-command.ts:153 returns the literal 'not replayable' for any run with a stopped stage. The line immediately above it, 151, successfully reads that run's manifest via loadRunManifest. The non-stopped branch at 137 decides replayability precisely by whether that manifest file exists. So the stopped branch has the evidence in hand and ignores it.

Observed on run 2026-09-06T21-58-29.508Z (audit-log, STOPPED:build). 'rehearsal list runs' calls it not replayable. Its manifest.json exists, and 'rehearsal list checkpoints' shows both an initial and a shape checkpoint with digests. A replay of its shape stage was started and did not refuse on the grounds of the run being stopped.

Cost: a stopped run is the case an operator most wants to replay. The stage graded badly, and the question is whether a corpus edit moves it. The label tells them the one run worth iterating on cannot be iterated on. The command still works if they ignore the label, which makes this a wrong signal rather than a broken feature.

Confirmed 2026-09-06: the shape stage of run 2026-09-06T21-58-29.508Z replayed successfully end to end while 'rehearsal list runs' labelled that run 'not replayable'. The replay produced a full graded attempt (record .benchmark-runs/replays/60758c01.../2026-09-06T22-33-15.057Z.json). So the label is wrong, not merely pessimistic.

Shaped 2026-09-07: fix confirmed as a one-line change. list-command.ts:153 hardcodes 'not replayable'; line 151's loadRunManifest(paths.manifestFile) call already succeeds by that point, proving the manifest exists, the same fact the non-stopped branch (line 137) uses to decide replayable. Fix: replace the literal with 'replayable' (or reuse the same ternary as line 137, now redundant since the load already proves existence). No design choice remains, first test: rerun 'rehearsal list runs' against the run recorded in the AC (2026-09-06T21-58-29.508Z) and confirm it now prints 'replayable'; add/adjust a unit test on listRuns for a stopped run with a manifest present.

Iteration stopped 2026-09-07 before the build session. 'iterate step' refuses a card in Build or Review that carries an assignee, as a guard against two sessions working one card. The shape session set assignee @claude when it moved the card to Build, per the board rule that a session sets @claude when it picks a card up. So the guard fires on the iteration's own bookkeeping. ACT-37, the previous card through this loop, reached Build with assignee [] and was not refused. Checked at the stop: no other claude session was running against this board, so nothing actually holds the card.
<!-- SECTION:NOTES:END -->
