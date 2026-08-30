---
id: ACT-3
title: replay one stage from a checkpoint
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-08-30 21:51'
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
- [x] #1 A CLI command replays a chosen stage from a chosen checkpoint in a fresh worktree; the primary checkout and its branch are untouched throughout.
- [x] #2 The replay records artifacts, trajectory, cost, and Judge result like a normal stage run, marked as a replay with its checkpoint and corpus version.
- [x] #3 Attempts at the same checkpoint can be presented side by side: artifacts, Judge grades, and diffs.
- [x] #4 The worktree is removed after grading; on failure the evidence is preserved and its path printed.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built and observed 2026-08-30. Commits c6d8e90..16e91c2 on main.

What changed:
- Run manifest written at run start beside the checkpoints (manifest.ts), so a run that dies mid-pipeline stays replayable.
- Initial checkpoint recorded at the task commit (decision 1); the stage loop takes its starting lineage from the caller. Stage names final/review/initial are reserved.
- Every recorded checkpoint pins its commit under refs/rehearsal/<run> in the target (decision 2), so restore and gc cannot prune replayed history.
- Stage validations take an expected branch; null means the detached worktree HEAD. Worktree add/remove wrap git worktree.
- executeStageSession extracted from the graded-stage loop; the run loop and replay share it.
- replay.ts: loadRunCheckpoints, resolveReplay (pure plan with chain verification), runReplay (worktree lifecycle, current-corpus install, frozen-lockfile dependency install for delivery stages per decision 3, judge with current rubric, strict-enveloped record under .benchmark-runs/replays/<consumed-lineage>/).
- attempts.ts: loadAttempts groups the original stage result and replays at one checkpoint; presentAttempts prints grades, dimensions, cost, changed paths, and diffs the latest attempt against earlier ones (decision 4).
- CLI: bun run replay --run <name> --stage <stage>; knobs and env fallbacks match the benchmark CLI; dirty control repo is recorded as <sha>-dirty, not refused.

Observed:
- Full suite green from fresh runs throughout (169 tests).
- Integration test drives runReplay with real git worktrees, materialization, instruction commits, and real assertPlanningStageCompleted; primary HEAD/branch/status byte-identical before and after; worktree list clean after; record validates; STOP verdict recorded without throwing; induced pre-grading failure keeps the worktree and prints its path.
- CLI observed on the error path: refuses a pre-manifest run naming it and listing replayable runs (none exist yet).

Not observed:
- A replay of a real recorded run with paid Claude sessions. No run with checkpoints exists yet; the first post-change benchmark run costs real money and is Joao's call. Until then the CLI happy path end-to-end (arg parsing -> paid sessions) is inferred from piecewise tests.
- Lineage equality/difference across corpus edits on a real run (pinned at unit level via lineageKey).

Known gaps, deliberate:
- A replayed build that switches branches in the worktree fails validation, but a branch it created survives worktree removal as debris in the shared repo.
- Checkpoint directory name is assumed to equal the stage name in two places (createRunFiles and runReplay).
- Replay result commits are not ref-pinned; the record keeps the diff, the commits may be gc'd.

Coordination: a parallel session is hardening tsconfig/oxlint across the repo. My files conform to exactOptionalPropertyTypes already; run.ts lines ~325/390/460/633 still need their mechanical spreads, agreed to land with their pass.

Independent review due: new subsystem touching git state in the target repository; review skill triggers apply.

Independent review, 2026-08-30
------------------------------
Reviewed at 16e91c2 (patch of 33d5cc3..16e91c2, 18 files, all examined by the reviewer). Suite run fresh on a clean export of 16e91c2: 169 pass, 0 fail. Axes: style, architecture, spec, security, testing, refactoring — none skipped. Security: nothing found (reviewer checked --run/--stage path traversal (operator authority only), zod parses at record boundaries, hashedFileSchema path refusal).

Findings and dispositions, worst first:

1. [correctness, should-fix, FIXED 767f0fa] The side-by-side compared the original attempt's judge-only cost (scorecard.costUsd, set from the judge envelope in stage-grading.ts) against the replay's stage+PO+judge sum, e.g. $0.50 vs $4.70 for identical real costs. Verified by reading run.ts/stage-grading.ts/attempts.ts. Attempts now carry judgeCostUsd (comparable across all) and a labeled totalCostUsd only where the record holds one. Suite green after.

2. [style, blocking at reviewed commit, FIXED by 0e2a3a6 (parallel lint session)] biome check failed at 16e91c2 on a claude.ts line this diff edited (formatter wrap). Verified red on the export of 16e91c2 and green on the export of 0e2a3a6, both this session.

3. [testing, should-fix, FIXED 54bf324] Every replay fixture set model and judgeModel to the same string, so swapping model for judgeModel in the record or lineage inputs left the suite green — the comparability lineage exists to pin. Verified by mutation: with distinct fixture values, changing replay.ts lineage input to request.judgeModel fails one test; before the fix it passed.

4. [architecture, should-fix, TRACKED ACT-14] .benchmark-runs layout knowledge duplicated across run.ts createRunFiles, replay-stage.ts resolveRunDirectory, and attempts.ts; divergence silently drops the original attempt from the side-by-side. Change created two of the three sites.

5. [refactoring, TRACKED already as ACT-12] parseArgs/parseReplayArgs duplicate the session-knob resolution block in config.ts.

6. [spec, REFUTED by later history] oxlint dependency added in d9d62b7 with nothing consuming it. Overtaken: 0e2a3a6 (coordinated parallel session, recorded above under Coordination) landed .oxlintrc.json and the lint script; verified consumed at current HEAD.

7. [style, FIXED d84bcf9] diffTexts ran git diff --no-index without --no-ext-diff/--no-color, unlike its siblings in target.ts; user diff.external or color.ui could corrupt the presentation. Flags added.

Notes, no action:
- Replay bypasses the .git/benchmark-run.json marker claimTarget honors; a replay during a live run is unguarded (temporal coupling, concurrency form). Worktree isolation makes most interleavings benign. Revisit with ACT-5 (parallel reps).
- Replay record path keyed by ISO timestamp collides at millisecond granularity; matters only for parallel replays (ACT-5).
- removeWorktree/rm(parent) after a successful record sit outside the try/catch, so a cleanup failure propagates without the evidence-preserved message; on the failure path the whole parent tmpdir is kept, not just the worktree.
- loadOriginalAttempt returns undefined on any schema failure, so a corrupt real scorecard is indistinguishable from never-graded.
- tsconfig strictness upgrade rode along in this range; coordination with the parallel lint session is recorded above, but it belonged in its own commit.
- Test maintainability aggregate: RunManifest literal repeated 4x (builder justified); first runReplay test asserts ~12 behaviors (Eager Test).

Reviewer cross-checked acceptance criteria 1-5 against the tests and recorded deferrals; all present, deferrals confirmed as recorded. Paid real-run replay remains unobserved, as the handoff records.

Verdict: proceed. Fixes 767f0fa, 54bf324, d84bcf9 verified with fresh suite runs (169 pass), tsc, biome, and oxlint this session.
<!-- SECTION:NOTES:END -->
