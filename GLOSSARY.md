# Glossary

- **Artifact** — durable output of a stage: a spec or plan document, a backlog
  card update, or commits.
- **Attempt** — one execution of a case's unit of work: a stage at a checkpoint
  (the original run's stage result or any replay) or one session of a session
  case. The unit a comparison presents.
- **Attempt record** — the strict record one session attempt writes: the case,
  the lineage, the model and effort, the declared corpus files with their
  digests, the prompt, the reply, the path of the transcript copy, the provider
  call metrics, and one result per declared check. It is what `--json` prints.
- **Attempt directory** — the fresh temporary directory the harness creates and
  owns for one session attempt, seeded from the case's fixture tree when it
  declares one. A session attempt never runs in a live repository, and the
  directory's real path is what names the attempt's project slug.
- **Calibration** — the human-review step that validates a Judge result and
  turns findings into rubric or instruction changes.
- **Checkpoint** — frozen state after an accepted stage: target SHA, workflow
  state, artifacts, and lineage.
- **Check-integrity file** — a target-relative file declared by the pipeline
  whose presence and bytes are frozen at baseline and compared after delivery.
- **Check kind** — one deterministic assertion a session case may declare, the
  discriminator of a check: `word-band` and `forbidden-text` read the reply,
  `tool-calls` and `files-read` read the transcript. A kind states what it
  needs and what it reports; the case supplies the values it compares against,
  so no literal a case could differ on lives in the check.
- **Check list** — the ordered deterministic checks a session case declares as
  its judge. It is evaluated over the reply and the transcript, needs no
  provider call, and its rep outcome is successful when and only when every
  check passes.
- **Confirmation run** — an explicitly requested group of at least two reps over
  one frozen input set, used by the outer loop to produce a score; defaults to
  five reps.
- **Command** — one named verb of the `rehearsal` executable (`run`, `replay`,
  `compare`, `case list`, `case show`, `case capture`), declaring its own flags with their
  defaults, environment fallbacks, and help lines as data. A name is one or two
  tokens; the longer declared name wins over a prefix of it. The declaration is the single source of
  the flag's name in help, parsing, and documentation.
- **Command record** — the strict, zod-validated artifact a command writes and
  the only thing `--json` prints: the run artifact for `run`, the replay record
  for `replay`, the comparison report for `compare`. A command never prints a
  second, summary-only shape.
- **Comparison** — a deterministic report over completed confirmation evidence
  for at least two benchmark cases, each containing the baseline, candidate,
  and control arms. It does not execute paid sessions.
- **Comparison arm** — one role in a comparison: baseline, candidate, or the
  mandatory minimal-corpus control. An arm uses the same corpus snapshot across
  every benchmark case.
- **Benchmark case** — one frozen task with its source or checkpoint and all
  non-corpus inputs; the independent unit on which comparison arms are paired.
- **Case declaration** — the committed `case.json` that states a benchmark case
  as data: its id, kind, title, and the case-relative inputs the kind needs. It
  is parsed once at the boundary into a value that cannot name a file outside
  its case directory.
- **Case directory** — `cases/<id>/`, the one place a case's declaration and its
  input files live. The directory name is the case id, and every path inside the
  declaration is resolved relative to it. Cases live in the control repository,
  never beside the corpus they grade.
- **Case kind** — which inputs a case declares and how an attempt at it is run:
  `pipeline`, today's stage graph against a target repository, or `session`, one
  Claude session. The kind is the discriminator of the case declaration, so a
  case cannot carry another kind's inputs.
- **Control repository** — this repository: harness, corpus under evaluation,
  rubrics, and run artifacts.
- **Corpus (instruction corpus)** — the instruction files under evaluation: the
  installed `CLAUDE.md`, the stage skills, the output styles, and the agent
  definitions. A case names the ones it reads in corpus layout paths
  (`CLAUDE.md`, `skills/<name>/...`, `output-styles/<name>.md`,
  `agents/<name>.md`), which one resolver maps onto the install, so an edit to
  any of them can make a prior attempt stale.
- **Cut** — the 0-based line index of the first session-file record a transcript
  prefix drops. A cut of N keeps lines [0, N).
- **Corpus layout path** — how a case names a corpus file, independent of where
  the corpus is installed: `CLAUDE.md`, `output-styles/<name>.md`,
  `agents/<name>.md`, or `skills/<name>/...`. One resolver maps a layout path
  onto the install, and a declared file that does not resolve is refused before
  any provider call.
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
- **Exit code** — what the executable returns, with one meaning each: `0` the
  command completed and wrote its record, whatever the grade; `2` a usage error
  (unknown flag, missing required flag, unparseable value); `3` a refused
  precondition (a needed approval whose flag is absent while stdin is not a
  TTY, a run that cannot be replayed); `1` an execution failure. A failing grade
  is evidence, not an error.
- **Fork** — copying a transcript prefix into the attempt directory's project
  slug under a fresh uuid, with every occurrence of the source session id
  rewritten, so a session can be resumed from it without its original working
  directory. On claude 2.1.258 the resumed session keeps that uuid and appends
  to the forked file rather than writing a new one.
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
  succeeds with Judge grade A or B; the final outcome succeeds with Judge PASS;
  a session case's rep succeeds when every check in its check list passes. A
  stop or execution failure is unsuccessful.
- **Replay** — re-running one stage from a checkpoint with the current corpus,
  in a fresh worktree.
- **Rubric** — the frozen grading contract a Judge applies; per-stage under the
  case's `rubrics/`, final in the case's `rubric.md`.
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
- **Project slug** — the name the provider gives the directory it writes a
  session file into: the working directory's real path with every `/` replaced
  by `-`. On macOS `/tmp/x` resolves through its real path first, so it is
  `-private-tmp-x`.
- **Sealed session** — a Claude session with safe mode and no tools, used for
  judges.
- **Session case** — a benchmark case whose unit of work is one Claude session
  rather than a stage graph. It declares an optional fixture tree, the prompt,
  an optional transcript prefix to resume, the tool and settings overlays, any
  agent definitions, the corpus files it reads, and its check list. It runs in
  an attempt directory, once as a debug attempt or under `--confirm` as reps,
  with the same records, reports, and cost ceiling as a stage replay.
- **Session knobs** — the CLI and environment settings shared by run and replay
  that select the workflow and Judge models and efforts and set the per-session
  spend limit.
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
- **Transcript prefix** — a real session file truncated at a cut, kept as the
  frozen starting state of a session case. Its bytes are git-ignored under
  `.benchmark-runs/cases/<case>/` and hashed into lineage; only its digest, its
  source session, and its cut are committed, in the case declaration.
- **Variant** — a named configuration: corpus snapshot, model, and effort.
- **Workflow state** — the untracked `backlog/` and `.boris/` trees that carry
  workflow artifacts between stages and must be copied independently of Git.
