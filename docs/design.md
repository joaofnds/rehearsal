# Design

How the current harness evolves into the tool described in
[vision.md](vision.md). Terms are defined in the [glossary](../GLOSSARY.md).

## Today

The harness runs one forward-only pipeline — Discuss → Grill → Plan → Build —
directly in the target repository on `main`, with a shared dynamic Product
Owner, an independent Judge after every stage, human calibration, and full
restoration afterward. The stage sequence, the judge attachments, and the
artifact expectations are code in `src/benchmark/`. A run either completes or
stops; no part of it can be re-entered.

Three capabilities separate this from the tool in the vision. Everything else —
sessions, judging, calibration, restoration, run artifacts — carries over.

## The three changes

### 1. Pipeline as data

The stage sequence, each stage's skill, its artifact expectations, and its
judge attachments become a declared pipeline the harness reads, instead of
code it is. The stage loop already runs behind an injectable seam; this makes
the injected value user-authored.

### 2. Checkpoint and replay

Every accepted stage transition becomes a checkpoint: the target's commit SHA,
the workflow state (`backlog/`, `.boris/`), the stage artifacts, and a lineage
key. Replay takes a checkpoint and the current corpus, materializes the
checkpoint in a fresh host worktree, runs that one stage, and presents its
artifacts, trajectory, and diff beside the previous attempt at the same
checkpoint. This is the inner loop's primitive: iterate on stage N without
paying for — or absorbing the variance of — stages 1..N-1.

### 3. Invalidation graph

The harness maps corpus files to the stages they feed: each skill to its
stage, global instruction files to every stage. A corpus edit marks downstream
checkpoints stale. Stale checkpoints can still be replayed for exploration,
but the tool refuses to present comparisons whose lineages differ.

## Concepts

- **Pipeline** — ordered stages with judge attachments; data, not code.
- **Stage** — one step: a skill invocation that consumes upstream artifacts
  and emits its own.
- **Checkpoint** — frozen state after an accepted stage: target SHA, workflow
  state, artifacts, lineage.
- **Lineage** — hash of everything that produced a checkpoint: upstream
  checkpoint, corpus files feeding the stage, model, effort.
- **Corpus snapshot** — the exact frozen project-instruction and stage/global
  skill bytes. A control-repository commit alone does not identify one because
  installed skills may live outside that repository.
- **Variant** — (corpus snapshot, model, effort).
- **Run** — one pipeline execution for a (task, variant); **Rep** — one of N
  repetitions; scores are distributions over reps.
- **Judge** — deterministic check or rubric-scored LLM evaluation attached to
  a stage transition; unchanged from today.

## Execution model

The task runs against a template project: a real application repository kept
at a stable baseline so results compare across runs. Replay and reps execute
in host git worktrees of that template — one worktree per rep, created at the
checkpoint's SHA, discarded after grading. Worktrees keep the real CLI, the
real corpus, the real hooks and host environment, and allow parallel reps;
the accepted cost is that each rep sees a different working-directory path,
so path-keyed state differs from the primary checkout. Containers are out:
they would replace the host environment the corpus is being tuned for.

## Decisions

1. **Benchmark against a template project, not the live repository.** Already
   true today; the vision keeps it. Comparability requires a stable baseline.
2. **Host worktrees for isolation and parallelism; no containers.** Rationale
   and accepted cost above.
3. **No sandcastle dependency.** Its agent providers are closed and expose
   none of the flags every session here needs (structured-output schema,
   budget, system prompt, sealed mode, session continuity); it reports no
   cost or duration; its merge-back machinery serves keeping agent work,
   while a benchmark discards it; it is pre-1.0. Its shape is worth
   borrowing: the worktree as a first-class value and provider interfaces
   for isolation backends, so a container arm could be added later without a
   rewrite.
4. **Checkpoints are keyed by lineage.** Comparisons across mismatched
   lineage are refused, so an improved upstream skill cannot leave downstream
   tuning silently optimizing against inputs that no longer exist. A model or
   effort change alters lineage and therefore invalidates everything.
5. **The corpus under evaluation stays clean.** The target-facing instruction
   files carry nothing about the harness; tool documentation lives here, in
   the control repository, outside the installed corpus.
6. **Comparisons are paired and reliability-first.** Corpus A/B runs execute
   both variants from identical checkpoints and report paired per-task deltas
   with standard errors; pass^k is the headline metric for the unattended
   goal; confirmation runs default to 5 reps. Evidence in
   [research.md](research.md).
7. **The control arm is mandatory.** Every comparison includes a
   no-corpus (or minimal-corpus) baseline, and cost and trajectory length
   are reported beside quality, so verbosity can never score as improvement.
8. **Judges are validated, not trusted.** The judge model defaults to a
   different family than the workflow model; calibration findings accumulate
   into a per-rubric judge-vs-human agreement figure that is re-baselined on
   every judge-model change.
9. **The pruning unit is the logical block** — an instruction bullet or skill
   section — never a line or token; smaller effects drown in run variance.

## Path from today

Ordered so every step is observable on its own; each is a ticket candidate.

1. **Pipeline as data** — declare the current Discuss → Grill → Plan → Build
   pipeline in a config the harness reads; behavior unchanged.
2. **Checkpoints** — record SHA, workflow state, artifacts, and lineage at
   every accepted stage transition in the run artifact.
3. **Stage replay** — a command that takes a checkpoint, materializes a
   worktree, runs one stage, and writes a comparable stage artifact beside
   the prior attempt.
4. **Invalidation** — corpus-to-stage map; stale marking; lineage-mismatch
   refusal in comparisons.
5. **Reps** — N parallel replays of a stage or pipeline; per-stage score
   distributions with standard errors, pass^k, cost, tokens, trajectory
   steps, wall-clock.
6. **Comparison reporting** — paired stage-by-stage deltas between corpus
   versions from identical checkpoints, always beside the control arm.

Later: variant matrices (model × effort), projected-cost preview before large
matrices, migration mode with ablation-based pruning.
