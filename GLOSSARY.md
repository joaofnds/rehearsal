# Glossary

- **Artifact** — durable output of a stage: a spec or plan document, a backlog
  card update, or commits.
- **Attempt** — one execution of a stage at a checkpoint: the original run's
  stage result or any replay; the unit a comparison presents.
- **Calibration** — the human-review step that validates a Judge result and
  turns findings into rubric or instruction changes.
- **Checkpoint** — frozen state after an accepted stage: target SHA, workflow
  state, artifacts, and lineage.
- **Check-integrity file** — a target-relative file declared by the pipeline
  whose presence and bytes are frozen at baseline and compared after delivery.
- **Confirmation run** — an explicitly requested group of at least two reps over
  one frozen input set, used by the outer loop to produce a score; defaults to
  five reps.
- **Comparison** — a deterministic report over completed confirmation evidence
  for at least two benchmark cases, each containing the baseline, candidate,
  and control arms. It does not execute paid sessions.
- **Comparison arm** — one role in a comparison: baseline, candidate, or the
  mandatory minimal-corpus control. An arm uses the same corpus snapshot across
  every benchmark case.
- **Benchmark case** — one frozen task with its source or checkpoint and all
  non-corpus inputs; the independent unit on which comparison arms are paired.
- **Control repository** — this repository: harness, corpus under evaluation,
  rubrics, and run artifacts.
- **Corpus (instruction corpus)** — the instruction files under evaluation:
  the installed `CLAUDE.md`, the stage skills, and related agent configuration.
- **Corpus snapshot** — the exact frozen project-instruction and stage/global
  skill bytes used by a confirmation group. A control-repository commit alone
  does not identify it because installed skills may live outside that repository.
- **Corpus tier** — stage-local (a skill; testable in stage mode) or global
  (`CLAUDE.md`, doctrine; validated only end-to-end).
- **Delivery stage** — a stage whose artifact is committed code; its
  evidence is a diff, changed paths, check integrity, and local check results.
  Today, `build`.
- **End-to-end mode** — running the whole pipeline and judging only the final
  code; the integration test.
- **Fresh checkpoint chain** — a replay's consumed checkpoint chain when none
  of its checkpoints is stale.
- **Judge** — evaluator attached to a stage transition: deterministic check or
  rubric-scored LLM with rationale.
- **Judge agreement baseline** — accumulated binary Judge and human decisions
  for one exact Judge model and frozen rubric contract, summarized separately
  for each rubric criterion.
- **Judge attempt** — one Judge call against frozen evidence and a rubric,
  recording its returned payload, call cost, and whether harness validation
  accepted or rejected it.
- **Lineage** — hash of everything that produced a checkpoint: upstream
  checkpoint, corpus files feeding the stage, model, effort.
- **Materialize** — write a checkpoint's frozen state into a directory,
  byte-faithfully, so a stage can run from it.
- **Model family** — a named Claude model line — Opus, Sonnet, or Haiku —
  recognized from either its native alias or a full model ID.
- **Pipeline** — the ordered stages and their judge attachments, declared as
  data.
- **Pipeline definition** — the declared, user-authored data the harness reads
  to know which stages to run, in what order, and with what skill, expected
  artifact, and rubric.
- **Planning stage** — a stage whose artifact is a durable document attached to
  the backlog card; it is carried forward as a prior artifact to later stages.
  Today, `discuss`, `grill`, and `plan`.
- **Product Owner (PO)** — the dynamic agent that answers stage questions from
  the product brief; one session per run.
- **Provider call** — one invocation of the model provider by a worker, Product
  Owner, or Judge. Its evidence may include usage metrics; the call remains
  explicit when those metrics are absent.
- **Rep** — one repetition of a run; scores are distributions over reps, never
  a single rep.
- **Rep outcome** — one binary reliability observation. A declared stage
  succeeds with Judge grade A or B; the final outcome succeeds with Judge PASS.
  A stop or execution failure is unsuccessful.
- **Replay** — re-running one stage from a checkpoint with the current corpus,
  in a fresh worktree.
- **Rubric** — the frozen grading contract a Judge applies; per-stage under
  `rubrics/`, final in `rubric.md`.
- **Rubric criterion** — one identified hard blocker, requirement, or quality
  dimension within a rubric, reduced to a binary pass/fail decision for
  calibration.
- **Score** — a statistical summary over a confirmation run's rep outcomes:
  their distribution, success rate with standard error, and pass^k. A
  single-rep Judge result is evidence, not a score.
- **Run artifact** — the recorded evidence of a run under `.benchmark-runs/`.
- **Run artifact transition** — one persistence operation that advances a run's
  main or stage record. Transitions are serialized; abort recording is terminal
  and cannot be overwritten by a later normal transition.
- **Sealed session** — a Claude session with safe mode and no tools, used for
  judges.
- **Stage** — one pipeline step: a skill invocation consuming upstream
  artifacts and emitting its own.
- **Stage commit history** — oldest-first subjects of the commits a stage added
  after its baseline; absent when the stage did not advance the target history.
- **Stage scorecard** — persisted Judge result for one stage: its frozen input
  and rubric, citations, grade, prompt, and Judge cost; a rejected scorecard
  also carries its calibration.
- **Stale checkpoint** — a checkpoint whose recorded inputs (corpus files,
  model, effort, or an upstream checkpoint) no longer match the current
  state; still replayable for exploration, refused in comparisons.
- **Stage kind** — which validation and evidence strategy a stage uses:
  planning or delivery. Declared per stage, independent of the stage's name.
- **Stage mode** — running one stage against frozen upstream artifacts; the
  unit test, with clean attribution and a proxy score.
- **Target repository (template project)** — the real application repository,
  kept at a stable baseline, that tasks run against.
- **Target check** — one command declared by the pipeline and run against the
  target repository both at baseline and after delivery.
- **Trajectory step** — one workflow-agent turn reported by the provider. PO and
  Judge turns are excluded so the measure tracks corpus-induced workflow
  behavior.
- **Variant** — a named configuration: corpus snapshot, model, and effort.
- **Workflow state** — the untracked `backlog/` and `.boris/` trees that carry
  workflow artifacts between stages and must be copied independently of Git.
