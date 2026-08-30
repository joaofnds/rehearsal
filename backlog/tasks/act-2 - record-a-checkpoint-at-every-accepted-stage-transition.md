---
id: ACT-2
title: record a checkpoint at every accepted stage transition
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-08-30 20:28'
labels: []
dependencies: []
references:
  - docs/design.md
ordinal: 2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a stage passes its Judge, freeze the state the next stage consumes: the target's commit SHA, the workflow state (backlog/, .boris/), the stage artifacts, and a lineage key hashing the upstream checkpoint, the corpus files feeding the stage, the model, and the effort. Checkpoints are the replay primitive and live in the run artifact. See docs/design.md 'Checkpoint and replay' and 'Concepts'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every accepted stage transition writes a checkpoint record: target SHA, workflow-state snapshot, stage artifacts, lineage key.
- [x] #2 The lineage key changes when and only when an input changes: upstream checkpoint, any corpus file feeding the stage, model, or effort.
- [x] #3 A test materializes a recorded checkpoint into an empty directory and the result matches the state the next stage consumed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: after each stage's Judge accepts, freeze the exact state the next stage consumes and key it by lineage, so ACT-3 can replay any stage from it.

What exists (read 2026-08-30):
- The stage loop (runGradedStages in src/benchmark/run.ts) already has an injected-dependency seam and unit tests; the checkpoint recorder becomes one more injected dependency.
- "Accepted" = assertStageGradePassed passes (verdict CONTINUE). A STOP stage writes no checkpoint.
- Workflow state (backlog/, .boris/ = WORKFLOW_PATHS) is untracked in the target; the target SHA does not cover it, so it must be snapshotted per stage. Both are small text trees today.
- Planning artifacts are already captured as ContextFile; delivery evidence (resultSha, diff, changedPaths) is already captured.
- Existing capture helpers (captureBoundedContent) truncate >256KB and drop binary; the snapshot must NOT use them, materialization has to be byte-faithful.
- The run artifact JSON is written only at run end. Checkpoints must persist incrementally as each stage is accepted, because the main replay use case is a run whose LATER stage failed; those runs never reach the final artifact write.

Design sketch (pending Q1/Q2 answers):
- Checkpoint record: stage name, target SHA (HEAD after the stage; resultSha for delivery), workflow-state snapshot reference + per-file sha256, stage artifacts, lineage key.
- Lineage key: sha256 over a canonical JSON of {upstream, corpusFiles: [{path, sha256}...], model, effort}. upstream = previous checkpoint's lineage key; for the first stage, a root hash of the initial state (taskSha + task text + product brief + initial workflow snapshot). Workflow model/effort only; judgeModel/judgeEffort excluded, per design decision 4.
- Corpus files per stage: the stage's skill files (stage-local tier) + the installed CLAUDE.md (global tier). Record path+hash per file so ACT-4 can attribute which file changed.
- Capture the snapshot right after stage validation (state the next stage consumes); persist it only after the grade passes.
- Snapshot capture/materialize live beside the target-git code; pure lineage hashing is its own function, unit-tested without a filesystem.

First test to write: the lineage key function. Same inputs give the same key; flipping upstream, one corpus-file hash, model, or effort each gives a different key; changing an excluded input (judge model) does not.

Acceptance as observations:
1. Unit test drives runGradedStages through a two-stage pipeline with stubbed dependencies: one checkpoint per accepted stage appears on disk with SHA, snapshot, artifacts, lineage; a STOP verdict leaves no checkpoint for that stage; checkpoints from earlier accepted stages survive a later stage's failure.
2. The lineage tests above.
3. Filesystem test: record a checkpoint from a fixture target, materialize it into an empty temp directory, byte-compare the tree against the state the next stage consumed.

Decisions (Joao, 2026-08-30):
1. The lineage hash reads each stage's skill files from the standard installed locations, the target's .claude/skills/<skill> first, then ~/.claude/skills/<skill>, and fails the run loudly when a stage's skill is found in neither. Moving the corpus into the control repository stays a possible separate task; not this one.
2. The workflow snapshot is written as plain files under .benchmark-runs/<run>.checkpoints/<stage>/ and referenced from the run-artifact JSON with per-file sha256. Byte-faithful, survives runs that fail at a later stage, human-readable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Handoff (build, 2026-08-30):

What changed: a new checkpoint module owns lineage hashing, corpus capture, snapshot recording, and materialization; the stage loop records a checkpoint after every accepted judge verdict into .benchmark-runs/<run>.checkpoints/<stage>/ (checkpoint.json + byte-faithful workflow-state copy), chained by lineage from a root key over the initial state; the run artifact lists the records; corpus for all stages is captured before the first session so a missing skill fails the run before any stage is paid for. README documents the new output.

Possible but not wired: materializeCheckpoint has no harness caller yet; ACT-3 (replay) is its consumer. Nothing reads the checkpoints from the run artifact yet; ACT-4 (invalidation) will.

Observed: full suite fresh run, 130 pass, plus typecheck and biome clean. Directly observed one real round-trip outside the suite: recorded a checkpoint of this control repository's own backlog/ and .boris/ with the real installed build skill resolved from ~/.claude/skills, materialized it into an empty directory, and recursive diff showed identical trees. That observation caught a defect the suite had missed: file-by-file materialization dropped empty directories that backlog tooling requires (planning validation reads backlog/docs); fixed to copy whole trees and verify hashes after.

Not verified: a full benchmark run against a real target (costs real sessions); checkpoint behavior when the target has large or binary workflow files.

Stopped on: ACT-11 filed to converge target.ts's workflow backup/restore with the new tree-copy code.

Review: due; new subsystem plus a change to the core stage loop, and ACT-3/ACT-4 build on its contract.

Independent review (2026-08-30): one reviewer, all axes (style, architecture, security, spec, testing, refactoring; none skipped). Patch at /tmp/act2-review/act2.patch; suite before review: 130 pass, 0 fail. Verdict: no blocking findings; 4 should-fix, 4 notes. All verified against the source; none refuted.

Findings and dispositions:
1. [should-fix, fixed 68959d1] Corpus hashed once at run start: a skill edited while earlier stages ran would feed a stage while its checkpoint recorded pre-run hashes, violating AC2's "when" direction. Fix: skill existence still resolved for all stages up front (fail before paying), hashing moved to each stage's start; interleaving pinned by a call-order test.
2. [should-fix, fixed 3266e3f] localeCompare in the canonical sort made the lineage key depend on host collation; identical corpora could mismatch across machines and refuse valid comparisons. Fix: codepoint sort, pinned by a B.md/a.md ordering test.
3. [should-fix, fixed 8ea8f78] Non-ENOENT stat errors (EACCES, EIO) read as "path absent": a checkpoint could silently record partial state as truth, and an unreadable skill directory was misreported as not installed. Fix: only ENOENT reads as absent; pinned by a chmod-000 test.
4. [should-fix, fixed 122dd6b] Materialize verified only recorded files, after copying: a planted snapshot file reached the destination unverified and a failed check left the tampered tree behind. Fix: snapshot must equal the record exactly before anything is copied; planted/modified/missing all pinned, destination stays empty on refusal.
5. [note, fixed 122dd6b] Record paths accepted "../": a tampered checkpoint.json could turn the mismatch error into a sha256 oracle for any readable file (local-only; writes were never affected). Schema now requires relative traversal-free paths.
6. [note, no action] The delivery checkpoint's artifacts list is empty; the commits are the artifact, reachable via targetSha. ACT-3 decides whether the record should say so explicitly.
7. [note, fixed 3266e3f] Root-lineage rationale comment sat above the wrong function; moved.
8. [note, fixed 3060acb] Dead casts in corpus test fixtures; replaced by a tuple type.

Reviewer-named load-bearing property, preserved by all fixes: checkpoint.json is written after the snapshot copy, so the record file is the commit marker and a crash mid-checkpoint fails loudly on materialize.

Fixes observed: fresh suite 135 pass 0 fail, typecheck and biome clean, and a re-run of the real round-trip (record this repository's workflow state with the real installed skill, materialize, recursive diff identical).
<!-- SECTION:NOTES:END -->
