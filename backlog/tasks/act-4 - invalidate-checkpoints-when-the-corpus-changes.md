---
id: ACT-4
title: invalidate checkpoints when the corpus changes
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-08-31 04:12'
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
- [x] #1 The harness derives, from the set of changed corpus files, exactly which stages and checkpoints are stale.
- [x] #2 Editing a stage skill marks that stage's and all downstream checkpoints stale; editing a global instruction file marks all stale; a model or effort change marks all stale.
- [x] #3 Replaying from a stale checkpoint works and is labeled stale in the record.
- [x] #4 Comparing attempts whose lineages differ is refused with an error naming the mismatched inputs.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built 2026-08-31. Four commits, plus one refactoring commit.

What shipped:
- deriveStaleness (src/benchmark/checkpoint.ts): pure function from a checkpoint chain, the current per-stage corpus, and the requested model/effort to per-checkpoint fresh-or-stale with named causes. Staleness carries downstream. The initial checkpoint consumes no corpus, so only a model or effort change makes it stale.
- GLOBAL_SKILLS (decision 2): captureStageCorpus now hashes the doctrine skill into every stage's corpus beside the installed CLAUDE.md. A global skill that is also the stage's own is hashed once. Lineage keys changed as predicted, so pre-existing checkpoints read as stale.
- resolveReplay returns the verified chain; runReplay derives staleness over it, logs each cause, and records stale/staleness in the replay record. Both fields optional in the schema so older records still parse.
- presentAttempts refuses attempts whose corpus, model, or effort differ, naming what differed and the two attempts. Attempts without recorded inputs are presented as before.

Direct observations (real files, real git repository, not only unit tests):
1. Recorded a two-stage chain with the real captureStageCorpus: unchanged corpus read fresh; editing the stage skill marked it stale naming skills/shape/SKILL.md; editing the doctrine skill marked it stale naming skills/doctrine/SKILL.md; a model change marked every checkpoint including the initial one stale.
2. Replay end to end against a real git repository with real skill files: unchanged corpus wrote stale=false; editing the upstream discuss skill wrote stale=true with the cause naming skills/discuss/SKILL.md, verified by re-reading the record from disk; replaying the edited discuss stage itself stayed fresh, which is the tuning loop the design intends.
3. Comparison guard: matching lineages present with the diff; corpus, model, and effort mismatches each refuse with the differing input and both attempt labels named.

Suite: 213 pass, 0 fail. Lint and typecheck clean.

Refactoring pass: staleness and the comparison guard had each grown their own walk over two sets of hashed files with the same three cases. Extracted corpusDifferences into checkpoint.ts with caller-supplied wording, since the two mean different things by a difference (record-versus-present has removed/added; attempt-versus-attempt has neither side as authority). Behavior preserved, 213 pass before and after, separate commit.

Filed ACT-18: the original run's attempt carries no lineage inputs, because the per-stage scorecard file never records the corpus, model, and effort the session ran with. So the most common comparison, original versus its own replay, is the one the guard cannot check. ACT-13 (split the test file) and ACT-14 (share the run-directory layout) already cover the other structural items this task touched.
<!-- SECTION:NOTES:END -->

## Review (2026-08-31)

Independent review dispatched: the change is outward-facing and touches the
comparison contract other stages will build on. Suite before review: 217 pass,
0 fail (`bun test`); typecheck, lint, and format check clean. Note: the repo's
CLAUDE.md names Biome, MikroORM, NestJS and a `test:unit` script, none of which
exist in package.json; the real commands are `bun test`, `bun run lint`,
`bun run typecheck`, `bun run fmt:check`.

Twelve findings. One blocking, six should-fix, five notes. All disposed.

### Blocking, fixed (commit e9b549e)

1. **A lineage mismatch ended the replay CLI with an unhandled rejection.**
   `presentAttempts` asserts comparable lineages first, and `replay-stage.ts`
   had no catch for `LineageMismatchError`. Reproduced: two replays of one
   stage across a corpus edit refuse with "Cannot compare replay 1 with replay
   2: they consumed different inputs (CLAUDE.md differs)". That is the primary
   tuning loop, and the refusal landed after the stage, product-owner, and
   judge sessions were paid for. The record and its path were already written,
   so nothing was lost on disk, but the command's deliverable was.
   Fix: the CLI catches the mismatch, prints it, and exits normally. Verified
   by driving the same handling over a mismatched pair: message printed,
   exit 0.

### Should-fix, fixed

2. **The guard only ever compared the second attempt** (commit e524e6e).
   Limiting `labelled.slice(1)` to `slice(1, 2)` left 213 pass, 0 fail. A
   mismatch introduced by a third replay would have been presented, which is
   AC #4's behavior. Pinned with a three-attempt case; the mutation now fails.

3. **Which upstream stage is blamed was unpinned** (commit e524e6e). Changing
   the latch from first-stale to nearest-stale left 213 pass, 0 fail. The
   three-stage fixture cannot tell the policies apart. Pinned with a
   four-stage chain and one corpus edit, where the two policies name different
   stages; the mutation now fails. (My first attempt at this test was also too
   weak and did not catch it; the four-stage chain does.)

4. **Staleness input wiring was unpinned** (commit e524e6e). Passing
   `"MUTATED"` and `["/nonexistent"]` into `currentChainCorpus` left 213 pass,
   0 fail, though that wiring decides whether every checkpoint reads stale.
   Every `runReplay` test stubbed `captureStageCorpus` ignoring arguments 2
   and 3. The harness now records the capture arguments and one test asserts
   the request's instructions and the worktree's skill roots reach it; the
   mutation now fails.

5. **`AttemptLineageInputs.effort` was `string`** (commit e9b549e), where
   `ReplayRecord`, `CheckpointInputs`, and `StalenessRequest` all use the
   `Effort` union. The type admitted a non-effort that would then be reported
   as a legitimate mismatch. Now `Effort`.

6. **Global skills were missing from pre-flight resolution** (commit e9b549e).
   `run.ts` resolved each stage's own skill before any stage ran, with a
   comment stating that invariant, but `captureStageCorpus` now also requires
   every `GLOBAL_SKILLS` entry. Only accidentally safe while doctrine exists.
   The loop resolves the global skills too, and a test covers a missing one.

7. **`AttemptLineageInputs`'s docstring described the consumed checkpoint's
   inputs** (commit e9b549e), but the field is populated from the replayed
   stage's own corpus, model, and effort. Reworded to what the field holds.

### Notes, no action here

- `corpusDifferences` reports a spurious removal when a path appears twice in
  its left argument. Verified. Unreachable today because captureStageCorpus
  builds unique paths. Tracked as ACT-19.
- A fresh chain prints nothing about staleness, so the user cannot distinguish
  fresh from a pre-feature build. Tracked as ACT-20.
- `hashedFileSchema` accepts control characters in `path`, which now flow into
  log lines and the mismatch message. Reaching it requires write access to the
  harness's own state directory, which is a full local compromise. Pre-existing
  schema behavior; recorded so it is not rediscovered.
- Test fixtures in the `deriveStaleness` block use four-character hashes where
  `hashedFileSchema` wants 64. `deriveStaleness` never parses, so these are
  valid unit inputs. No action.
- Duplicated `{stage, causes}` shape across `CheckpointStaleness`,
  `ReplayRecord.staleness`, and its zod object. Advisory refactoring finding;
  ACT-13 and ACT-14 already track the structural items this task touched.

The reviewer also flagged the test file's size as Divergent Change risk; ACT-13
already tracks splitting it.

Suite after all fixes: 217 pass, 0 fail. Typecheck, lint, and format check
clean. Each of the three mutations above was re-run against the fixed suite and
now fails.
