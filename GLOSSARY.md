# Glossary

- **Artifact** — durable output of a stage: a spec or plan document, a backlog
  card update, or commits.
- **Attempt** — one execution of a stage at a checkpoint: the original run's
  stage result or any replay; the unit a comparison presents.
- **Calibration** — the human-review step that validates a Judge result and
  turns findings into rubric or instruction changes.
- **Checkpoint** — frozen state after an accepted stage: target SHA, workflow
  state, artifacts, and lineage.
- **Control repository** — this repository: harness, corpus under evaluation,
  rubrics, and run artifacts.
- **Corpus (instruction corpus)** — the instruction files under evaluation:
  the installed `CLAUDE.md`, the stage skills, and related agent configuration.
- **Corpus tier** — stage-local (a skill; testable in stage mode) or global
  (`CLAUDE.md`, doctrine; validated only end-to-end).
- **Delivery stage** — a stage whose artifact is committed code; its
  evidence is a diff, changed paths, check integrity, and local check results.
  Today, `build`.
- **End-to-end mode** — running the whole pipeline and judging only the final
  code; the integration test.
- **Judge** — evaluator attached to a stage transition: deterministic check or
  rubric-scored LLM with rationale.
- **Judge attempt** — one Judge call against frozen evidence and a rubric,
  recording its returned payload, call cost, and whether harness validation
  accepted or rejected it.
- **Lineage** — hash of everything that produced a checkpoint: upstream
  checkpoint, corpus files feeding the stage, model, effort.
- **Materialize** — write a checkpoint's frozen state into a directory,
  byte-faithfully, so a stage can run from it.
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
- **Rep** — one repetition of a run; scores are distributions over reps, never
  a single rep.
- **Replay** — re-running one stage from a checkpoint with the current corpus,
  in a fresh worktree.
- **Rubric** — the frozen grading contract a Judge applies; per-stage under
  `rubrics/`, final in `rubric.md`.
- **Run artifact** — the recorded evidence of a run under `.benchmark-runs/`.
- **Sealed session** — a Claude session with safe mode and no tools, used for
  judges.
- **Stage** — one pipeline step: a skill invocation consuming upstream
  artifacts and emitting its own.
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
- **Variant** — a named configuration: corpus version, model, and effort.
