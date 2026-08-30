---
id: ACT-4
title: invalidate checkpoints when the corpus changes
status: Build
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-08-30 22:20'
labels: []
dependencies:
  - ACT-2
references:
  - docs/design.md
ordinal: 4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Map corpus files to the stages they feed: each stage skill to its stage, global instruction files (installed CLAUDE.md) to every stage. A corpus edit marks downstream checkpoints stale. Stale checkpoints remain replayable for exploration, but comparisons across mismatched lineages are refused. See docs/design.md 'Invalidation graph' and decision 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness derives, from the set of changed corpus files, exactly which stages and checkpoints are stale.
- [ ] #2 Editing a stage skill marks that stage's and all downstream checkpoints stale; editing a global instruction file marks all stale; a model or effort change marks all stale.
- [ ] #3 Replaying from a stale checkpoint works and is labeled stale in the record.
- [ ] #4 Comparing attempts whose lineages differ is refused with an error naming the mismatched inputs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: derive which checkpoints a corpus, model, or effort change invalidates; label stale replays; refuse comparisons across mismatched lineages.

What exists (read 2026-08-31):
- Checkpoint records (src/benchmark/checkpoint.ts) already store, per stage, the hashed corpus files that fed it (installed CLAUDE.md + the stage's skill directory), the model, the effort, and the upstream chain. The recorded corpusFiles ARE the corpus-to-stage map the card asks for; no new mapping structure is needed.
- captureStageCorpus recomputes the current per-stage corpus hashes; diffing recorded vs current yields exactly the changed files (AC #1).
- presentAttempts/loadAttempts (src/benchmark/attempts.ts) is today's only comparison surface. ACT-6 owns the statistical compare and will reuse this task's refusal guard.
- Replay records use a strict zod schema; the staleness field must be optional so records written before this task still parse.

Decisions (Joao approved recommendations, 2026-08-31):
1. Staleness surfaces in the replay CLI output for the run's whole chain; no dedicated listing command until ACT-6 needs one.
2. Global skills join the corpus hash: captureStageCorpus adds the doctrine skill directory (resolved from the same skill roots) to every stage's corpusFiles, beside the installed CLAUDE.md. The global set is a declared list (doctrine today) so adding another global skill later is one entry. Consequence: lineage keys change; checkpoints recorded before this task will read as stale because their records lack the doctrine files. That is honest and accepted.

Design:
- Pure staleness function: (checkpoint chain, current per-stage corpus hashes, requested model/effort) -> per checkpoint, fresh or stale with named causes (changed file paths, model, effort, or stale upstream stage). A stage checkpoint is stale when any recorded corpus file hash differs from current, the model or effort differs from the request, or its upstream is stale. A current corpus file absent from the record (or vice versa) is a change and names the file. The initial checkpoint records no corpus files, so it goes stale only on a model or effort change; a CLAUDE.md or doctrine edit marks every stage checkpoint stale by construction (AC #2, with the initial-checkpoint nuance stated).
- Replaying stage N consumes checkpoint N-1. Editing stage N's own skill leaves the consumed checkpoint fresh: that replay is the tuning loop, not exploration of a dead lineage. Editing anything upstream labels the replay stale. A stale replay proceeds; the record stores the causes and the CLI prints them (AC #3).
- Comparison guard: all attempts presented together must share the consumed checkpoint's lineage; on mismatch, refuse with an error that names the differing inputs by diffing the recorded lineage inputs (corpus file paths, model, effort, upstream). Attempt gains the consumed-lineage inputs it needs for that (AC #4).

Acceptance as observations:
1. Unit, staleness function: unchanged inputs -> all fresh; flip one skill file hash -> that stage and all downstream stale, cause names the file; flip the CLAUDE.md or a doctrine file hash -> every stage checkpoint stale; different model or effort -> all stale including initial; a file present on one side only -> stale, names the file.
2. Unit, corpus capture: captureStageCorpus includes doctrine files for every stage, paths recorded machine-independently.
3. Real: record a run, edit an upstream skill file, replay a downstream stage -> replay output prints the chain's staleness and the stored record is labeled stale, naming the file; replay the edited stage itself -> not labeled stale.
4. Unit, guard: presenting attempts with mismatched consumed lineages throws, error names the differing corpus file/model/effort; matching lineages present as before.

First test to write: the staleness derivation function, cases above.

Glossary: added "Stale checkpoint" (2026-08-31).
<!-- SECTION:PLAN:END -->
