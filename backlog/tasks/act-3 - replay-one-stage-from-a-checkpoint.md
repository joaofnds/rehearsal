---
id: ACT-3
title: replay one stage from a checkpoint
status: Build
assignee: []
created_date: '2026-08-30 12:43'
updated_date: '2026-08-30 20:49'
labels: []
dependencies:
  - ACT-2
references:
  - docs/design.md
ordinal: 3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The inner-loop primitive: a command that takes a checkpoint and the current corpus, materializes the checkpoint in a fresh host git worktree of the target, runs that one stage, and records a stage artifact comparable with prior attempts at the same checkpoint. The primary checkout is never touched. See docs/design.md 'Checkpoint and replay' and 'Execution model'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A CLI command replays a chosen stage from a chosen checkpoint in a fresh worktree; the primary checkout and its branch are untouched throughout.
- [ ] #2 The replay records artifacts, trajectory, cost, and Judge result like a normal stage run, marked as a replay with its checkpoint and corpus version.
- [ ] #3 Attempts at the same checkpoint can be presented side by side: artifacts, Judge grades, and diffs.
- [ ] #4 The worktree is removed after grading; on failure the evidence is preserved and its path printed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: a CLI command that replays one stage from a checkpoint in a fresh git worktree of the target, records a comparable attempt, and never touches the primary checkout.

What exists (read 2026-08-30):
- ACT-2 delivered recordCheckpoint/materializeCheckpoint; materializeCheckpoint has no caller yet and verifies the snapshot against the record before copying.
- Checkpoints live at .benchmark-runs/<run>.checkpoints/<stage>/ (checkpoint.json + byte-faithful workflow-state tree), chained by lineage from a root key.
- Replaying stage N consumes the checkpoint of stage N-1 (state after N-1 was accepted).
- The run artifact JSON is written only at run end, so a run that fails mid-pipeline leaves no record of task text, brief, taskId, or pipeline, which replay needs. Decision: write a run manifest at run start (task, brief, taskId, taskSha, pipeline, source root, config) beside the checkpoints; replay reads manifest + checkpoint.
- Planning artifacts live under backlog/docs inside the workflow snapshot; prior artifacts for the judge are reconstructed by walking earlier checkpoints' artifact lists and reading contents from the materialized snapshot, hash-verified.
- Replay uses the current CLI config for model/effort/budget; that is the variant knob. Judge runs with the current rubric. Comparison unit is the Attempt (glossary): original stage result or any replay at the same checkpoint, keyed by the consumed checkpoint's lineage.
- Worktree: git worktree add --detach at the checkpoint's targetSha in a temp path, materialize workflow state into it, run stage, grade, worktree remove after grading (any verdict); on error before grading completes, keep it and print the path.
- Replay record: same scorecard shape as stage files, plus replay marker, consumed checkpoint lineage, corpus file hashes, own lineage (checkpoint upstream + current corpus + model + effort), control SHA, cost, transcript. Stored under .benchmark-runs/replays/<checkpoint-lineage>/<timestamp>.json so attempts at one checkpoint group naturally.

Decisions (Joao approved recommendations, 2026-08-30, doctrine-checked):
1. Record an initial checkpoint at run start so stage 1 replays like any other stage; removes the special case (define errors out of existence). Runs recorded before this change cannot replay stage 1; replay says so loudly.
2. Write a namespaced ref (refs/rehearsal/<run>) in the target at checkpoint time so task/result commits survive branch restore and gc. Doctrine 8: retention currently rests on an unnamed gc-default guarantee; the ref makes it a guard the system enforces. Refs are harness state in the target's git, not corpus; design decision 5 (corpus stays clean) is untouched.
3. Delivery-stage replay runs dependency install in the worktree before checks, with the lockfile frozen so the replayed stage sees the dependencies the checkpoint's SHA declares (controlled variables). Bun commands are already the codebase idiom in checks.ts.
4. Replay prints the side-by-side comparison at the end; stored attempt records keep a later compare command possible (last responsible moment).

Doctrine notes for build: keep replay resolution pure (deterministic core, effects injected like runGradedStages' StageDependencies); walking-skeleton order — thinnest slice is replaying one planning stage end-to-end with stubs before delivery-stage evidence capture.

First test to write: pure resolution of a replay request (manifest + checkpoint records + stage name) into a plan: checkpoint directory, target SHA, prior artifacts; loud failure when the stage has no preceding checkpoint or the run predates manifests.

Acceptance as observations:
1. Unit: replay loop drives materialize/worktree/stage/judge through stubs; primary checkout path never passed to any stage dependency; worktree removed after grading, kept on induced pre-grading failure with path printed.
2. Real: replay a stage from a recorded run; git -C <primary> status and HEAD byte-identical before and after; worktree list clean afterwards.
3. Replay record on disk validates against its schema, marked as replay with checkpoint lineage and corpus hashes; lineage equals the original stage's when the corpus is unchanged and differs after editing one skill file.
4. Side-by-side presentation of two attempts at one checkpoint: judge grades and artifact diff visible in one output.
5. Stage-1 replay from the initial checkpoint succeeds on a run recorded after decision 1; on an older run the command fails with a message naming the missing initial checkpoint.
<!-- SECTION:PLAN:END -->
