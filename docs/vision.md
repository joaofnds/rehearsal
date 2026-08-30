# Vision

Rehearsal is a personal instruction-corpus improvement tool: a debugger and a
regression suite for the instructions an engineer gives their coding agent — the
project `CLAUDE.md`, the skills that own each workflow stage, and the judge
rubrics that grade the results.

Model labs have evaluation harnesses, regression suites, and migration testbeds
for their models. An individual engineer maintaining a nontrivial corpus has
none of that. The consequences:

- Corpora are tuned by feel. Instructions are added when something goes wrong
  and almost never removed, because nothing shows what each one contributes.
- There is no attribution. Nobody can say which line of a corpus earns its
  tokens and which just burns them.
- A model release silently invalidates the corpus. The common response is to
  ask the new model to rewrite its own instructions, with no verifiable way to
  see whether the rewrite helped.
- Single runs are too noisy to trust. Identical reruns of the same task swing
  severalfold in tokens and outcome, so one trial proves nothing.

## Core insight

A disciplined workflow is already factored by stage. Each stage is owned by a
skill, consumes the artifacts of the stage before it — documents, backlog
cards, commits — and emits artifacts of its own. That factoring is a dependency
graph, and the tool exploits it the way a build system does:

- **Attribution.** A skill edit can only affect its own stage directly;
  everything downstream feels it through artifacts. When a stage is re-run with
  frozen inputs and one skill changed, the delta belongs to that edit.
- **Incremental re-runs.** From the file that changed, the tool knows which
  stages need re-running and which checkpoints went stale. Iteration costs one
  stage, not the whole pipeline.
- **Honest pricing of corpus tiers.** Skills are stage-local and cheap to test.
  Global instructions (`CLAUDE.md`, doctrine) touch every stage and only
  end-to-end runs can validate a change to them. The tool makes that cost
  visible instead of hiding it.

## The two loops

The tool runs one loop inside another, with different evidence standards:

- **Inner loop — debug.** Run one stage once from a frozen checkpoint. The
  human (or an AI peer reviewer) reads the artifacts, the trajectory, and the
  diff against the previous attempt, forms a hypothesis about which instruction
  to change, edits it, and replays. Fast, cheap, single-rep, judged by eye.
- **Outer loop — confirm.** Before an edit is accepted into the corpus, a
  multi-rep judged run shows the score distribution moved. A single rep is
  never presented as a score.

The inner loop makes iteration fast; the outer loop keeps single-run
impressions from hardening into corpus dogma.

## The two modes

- **Stage mode** runs one stage against frozen upstream artifacts. Attribution
  is clean, but the score is a proxy: better intermediate artifacts, not
  necessarily better final code. These are the unit tests.
- **End-to-end mode** runs the whole pipeline and judges only the true
  objective — the committed code. Attribution is smeared across every skill,
  but the score is the one that matters. This is the integration test.

Debug in stage mode, confirm in end-to-end mode. A skill edit that improves its
stage's artifacts without improving the final code is a finding, not a win — it
identifies exactly the kind of instruction that accumulates unnoticed.

## Principles

- Local-first: the engineer's machine, credentials, and real agent CLI. No
  simulation layer between the corpus and the model.
- Deterministic judges wherever a check can be deterministic; LLM judges only
  for genuinely semantic quality, always rubric-based, always with rationale.
- Every comparison keeps a baseline control arm, so verbosity is never
  mistaken for improvement.
- Any model or effort change invalidates every prior score for that task.
- Projected cost is shown before a multi-rep or multi-variant run, not after.

## Later

Once the replay loop works, the same harness supports side-by-side variants
(corpus version × model × effort) and a migration mode: run the frozen suite
against a new model, ablate instructions singly or in blocks, and surface both
pruning candidates and regressed stages that need new instructions.
