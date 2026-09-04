---
id: ACT-65
title: a confirmed replay records frozen instructions the session never read
status: To Do
assignee: []
created_date: '2026-09-04 17:47'
updated_date: '2026-09-04 17:47'
labels: []
dependencies: []
type: bug
ordinal: 62008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by independent review of ACT-41, 2026-09-04, and confirmed against the code.

In a confirmed replay, replay-confirmation.ts:458 passes frozen.instructions into the stage session, which hashes those bytes into the rep's corpus record. The session itself runs with corpusRoots [worktree/.claude] (replay-confirmation.ts:466), and installStageCorpusSnapshot (checkpoint.ts:270) copies only skills, agents, and output-styles into that directory. It never copies CLAUDE.md, although snapshotStageCorpus writes one into the snapshot at checkpoint.ts:234. So the frozen instruction bytes are written to the snapshot and never read back.

Effect: edit the live corpus CLAUDE.md after a checkpoint, then run a confirmed replay. The record says the rep ran against the frozen bytes. The session read whatever is live. The measurement names a corpus the session did not use.

installStageCorpusSnapshot never copied CLAUDE.md, verified identical at 946919a. Before ACT-41, installInstructions wrote the frozen bytes into the worktree root on every replay, which masked the gap. ACT-41 removed that write, correctly, because it also overwrote the target's own project instructions. Removing it exposed the missing delivery rather than causing it.

Debug replay is not affected: replay.ts reads live (replay-command.ts:216) and searches corpusLayoutRoots(worktreeDir) (replay.ts:424), so what it hashes and what the session reads agree.

Before building, settle one fact this card does not assume: where a stage session actually reads project instructions from, given settingSources 'project' and cwd at the worktree. The fix depends on whether a project-level .claude/CLAUDE.md is loaded at all, which nobody has verified on the current claude version. The review's advisory note is that captureStageCorpus and snapshotStageCorpus take instructions as a string while every other corpus kind is resolved from roots, and that asymmetry is what allowed a write nothing reads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A confirmed replay rep's recorded corpus CLAUDE.md hash is the bytes the replayed session actually read
- [ ] #2 Editing the live corpus CLAUDE.md between a checkpoint and a confirmed replay does not change what the replayed session reads
<!-- AC:END -->
