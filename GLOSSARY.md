# Glossary

- **Accepted band** — the word range João's own accepted rewrites occupied on
  the turns a case replays, measured from his real sessions rather than chosen:
  51 to 154 across the population, 108 to 145 on these four turns. A case
  declares its ceiling as a `word-band` check, never its floor, because a reply
  shorter than the one he accepted is not a failure. The band is a property of
  what he kept, so it moves only when new accepted replies are measured.
- **Artifact** — durable output of a stage: a spec or plan document, a backlog
  card update, or commits.
- **Attempt** — one execution of a case's unit of work: a stage at a checkpoint
  (the original run's stage result or any replay) or one session of a session
  case. The unit a comparison presents.
- **Attempt record** — the strict record one session attempt writes: the case,
  the lineage, the model and effort, the declared corpus files with their
  digests, the corpus snapshot origin, the prompt, the reply, the path of the
  transcript copy, the provider call metrics, and one result per declared check.
  It is what `--json` prints. A record carrying no origin was written before the
  field existed and read the live install.
- **Attempt directory** — the fresh temporary directory the harness creates and
  owns for one session attempt, seeded from the case's fixture tree when it
  declares one. A session attempt never runs in a live repository, and the
  directory's real path is what names the attempt's project slug.
- **Calibration** — the step that validates a Judge result against a human
  review and turns findings into rubric or instruction changes. It reads the
  frozen evidence a run recorded and the corpus files as they stand now, never
  the live target, so it can run long after the target was restored. It is one
  function of the review, the frozen evidence, and the current rubrics and
  instructions, whether a paused run calls it in a retry loop or the
  `calibrate` command calls it once.
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
  five reps. The UI's design calls this a **group** and counts it in plural
  **attempts** (`group · 6 attempts`, the `×1/×3/×6/×12` replay control, the
  Cases screen's **Run group** action); the word in code, records, and this
  glossary stays confirmation run (decision-5).
- **Command** — one named verb of the `rehearsal` executable (`run`, `replay`,
  `compare`, `review`, `calibrate`, `list`, `show`, `stale`, `case list`,
  `case show`, `case capture`), declaring its own flags with their defaults, environment
  fallbacks, and help lines as data. A name is one or two
  tokens; the longer declared name wins over a prefix of it. The declaration is the single source of
  the flag's name in help, parsing, and documentation, and a command with no
  declared flag prints no flag section.
- **Command record** — the strict, zod-validated artifact a command writes and
  the only thing `--json` prints: the run artifact for `run`, the replay record
  for `replay`, the comparison report for `compare`, and for `show` the bytes
  of the one record file its id names. A command never prints a
  second, summary-only shape.
- **Comparison** — a deterministic report over completed confirmation evidence
  for at least two benchmark cases, each containing the baseline, candidate,
  and control arms. It does not execute paid sessions.
- **Comparison arm** — one role in a comparison: baseline, candidate, or the
  mandatory minimal-corpus control. An arm uses the same corpus snapshot across
  every benchmark case.
- **Benchmark case** — one frozen task with its source or checkpoint and all
  non-corpus inputs; the independent unit on which comparison arms are paired.
- **Case** (design usage) — the UI design's phrase for a task plus the
  corpus, judges, and thresholds it runs under. It overlaps with this
  glossary's benchmark case without matching field for field: the case
  declaration pins task, product brief, final rubric, per-stage rubrics,
  pipeline, and target, but has no case-level `corpus` field (corpus is
  chosen per run by `--corpus`) and no case-level threshold field (a minimum
  grade lives inside stage grading, not on the case) (decision-5).
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
- **Contribution** — one of the three run-detail UI layouts. It grades a run's
  outcome on its own, from recorded evidence, then has an agent (not a
  deterministic computation) name a likely culprit stage among those that
  ran. The agent's reading is disclosed as an opinion, never as a
  measurement, and is provisional until the run ends. It is not an ablation:
  ablation needs a rerun per node and is a separate planned feature
  (decision-5).
- **Context manifest** — the complete set of instruction and context inputs one
  attempt actually loaded, each named, classified by tier, and hashed where the
  harness can resolve its bytes. It has two halves: the corpus half, the
  engineer's global instruction set, varied by `--corpus`, and the project half,
  the target repository's own instructions and documents, a property of the
  target. It is observed from the transcript and reconciled against what the
  case declared, so a divergence is reported rather than silently recorded. The
  transcript names a load without carrying its bytes, so reconciliation is
  name-against-name and every hash comes from the corpus resolver.
- **Corpus (instruction corpus)** — the instruction files under evaluation: the
  installed `CLAUDE.md`, the stage skills, the output styles, and the agent
  definitions. A case names the ones it reads in corpus layout paths
  (`CLAUDE.md`, `skills/<name>/...`, `output-styles/<name>.md`,
  `agents/<name>.md`), which one resolver maps onto the install, so an edit to
  any of them can make a prior attempt stale.
- **`corpus@<hash>`** — run history's label for a run's corpus digest: what one
  stage's checkpoint actually read, computed over the checkpoint's own
  recorded corpus files. Distinct from `corpus root@<hash>`, which digests a
  different set of files.
- **`corpus root@<hash>`** — the corpus screen's label for a digest over every
  file in the live corpus tree, including files no stage has ever read. Two
  screens computing a digest over two different file sets is why the label
  differs from `corpus@<hash>` rather than reusing it.
- **Cut** — the 0-based line index of the first session-file record a transcript
  prefix drops. A cut of N keeps lines [0, N).
- **Corpus layout** — the directory shape a corpus takes once resolved, and the
  only shape the harness reads: `CLAUDE.md`, `skills/<name>/`,
  `output-styles/<name>.md`, and `agents/<name>.md` under one root. A corpus
  layout path names a file within it. Every corpus source resolves to this
  layout, so the code that hashes and installs a corpus never learns where the
  bytes came from.
- **Corpus layout path** — how a case names a corpus file, independent of where
  the corpus is installed: `CLAUDE.md`, `output-styles/<name>.md`,
  `agents/<name>.md`, or `skills/<name>/...`. One resolver maps a layout path
  onto the install, and a declared file that does not resolve is refused before
  any provider call.
- **Corpus snapshot** — the exact frozen project-instruction and stage/global
  skill bytes used by a confirmation group. A control-repository commit alone
  does not identify it because installed skills may live outside that repository.
  A session attempt's snapshot holds the files its case declared and no others,
  so a source carrying an undeclared style cannot change what the attempt runs
  against.
- **Corpus overlay** — the project-level files a session attempt is given so it
  reads a corpus variant: the snapshot's output styles and agent definitions
  written under the attempt directory's `.claude/`, where they shadow the
  same-named user-level ones. The session runs with the live configuration, so
  its hooks, memory, and MCP are the real ones and nothing installed moves. A
  skill cannot be delivered this way, because a project-level skill does not
  shadow a user-level one.
- **Corpus snapshot origin** — where a snapshot's bytes were read from, recorded
  beside them and persisted in the attempt record: the live install, or the
  directory the source named. What produced that directory is not recorded,
  because the harness never learns it.
- **Corpus source** — where an attempt's corpus bytes come from, named by
  `--corpus`: a directory already in corpus layout, and nothing else. A corpus
  that lives somewhere else is rendered to a directory with whatever tool owns
  it, outside rehearsal, and that directory is passed. Absent `--corpus` the
  source is the live install. A source is resolved to one snapshot directory
  before any provider call, and that directory is the single place the bytes are
  read from for hashing and installing.
- **Corpus tier** — stage-local (a skill; testable in stage mode) or global
  (`CLAUDE.md`, doctrine; validated only end-to-end).
- **Corpus variant** — one corpus a comparison arm runs against, identified by
  the snapshot its source resolved to rather than by the source string, so two
  directories holding the same bytes are the same variant. It is the corpus half
  of a variant, which also fixes model and effort.
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
- **Fired reply** — the end-of-turn reply João answered with `/brief`. It is the
  reply the style produced and he rejected, not the one he wanted; the rewrite
  he accepted comes later in the same session. A cut is the fired reply's own
  index, so the prefix keeps everything that produced it and drops the reply
  itself, and the attempt writes its own reply in that place.
- **Fork** — copying a transcript prefix into the attempt directory's project
  slug under a fresh uuid, with every occurrence of the source session id
  rewritten, so a session can be resumed from it without its original working
  directory. On claude 2.1.258 the resumed session keeps that uuid and appends
  to the forked file rather than writing a new one.
- **Fresh checkpoint chain** — a replay's consumed checkpoint chain when none
  of its checkpoints is stale.
- **Human review** — the verdict, summary, and classified findings a reviewer
  records against a run's Judge result, in `<run>.review.json`. The reviewer is
  a person or the agent standing in for one; the name says whose judgment the
  record carries, not which hand typed it. `rehearsal review` writes it from
  flags or from a file, and calibration reads it.
- **Interrupted run** — a run whose process ended (a `kill -9` or a crash)
  without writing a terminal artifact or stop record. It has no status of its
  own on disk; the server's startup reconciliation pass finds it by checking
  whether the pid the run's claimed target recorded is still alive, and if
  not, marks the run's event stream `run-interrupted`, distinct from `FAILED`,
  which a graceful signal handler still writes on its own.
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
- **No reply** — the outcome of a session attempt whose envelope carried no
  result, the provider having stopped at its turn or budget limit. It is not a
  reply of zero words: no check is evaluated and none is recorded, so the
  attempt reads as a measurement that did not happen rather than one that
  passed.
- **Pause** — the interactive stop a run makes with the candidate still in the
  target, asking the reviewer to edit files and press Enter until the
  calibration validates. It is requested by `--pause` and needs a TTY, refused
  before any paid work without one. A run without `--pause` never stops: it
  writes the preliminary artifact, retains the candidate, restores the target,
  and exits, leaving the review and the calibration to their own commands.
- **Pipeline** — the ordered stages and their judge attachments, declared as
  data. The UI's design calls this a **task** (decision-5); the word in code,
  records, and this glossary stays pipeline. Graded as a whole, a pipeline's
  grade is computed from its first input and its last artifact only, never by
  averaging stage grades, and a pipeline that stopped early is not gradable as
  a whole.
- **Pipeline definition** — the declared, user-authored data the harness reads
  to know which stages to run, in what order, and with what skill, expected
  artifact, and rubric.
- **Planning stage** — a stage whose artifact is a durable document attached to
  the backlog card; it is carried forward as a prior artifact to later stages.
  Today, `discuss`, `grill`, and `plan`.
- **Project instructions** — the instruction file a repository carries in its
  own tree for agents working in it (`CLAUDE.md` or `AGENTS.md`). A property of
  the repository, never installed by the harness. Distinct from the corpus's
  global `CLAUDE.md`, which is the file under evaluation.
- **Product Owner (PO)** — the dynamic agent that answers stage questions from
  the product brief; one session per run.
- **Provider call** — one invocation of the model provider by a worker, Product
  Owner, or Judge. Its evidence may include usage metrics; the call remains
  explicit when those metrics are absent.
- **Record ID** — how a session names one recorded thing to the CLI and how
  the CLI names it back: a kind prefix and the identity that kind already has
  on disk, `case:<id>`, `run:<name>`, `checkpoint:<run>/<stage>`,
  `attempt:stage:<lineage>/<timestamp>`, `attempt:session:<case>/<uuid>`,
  `group:<group-id>`, `comparison:<manifest-digest>`. Every id `list` prints is
  one `show` accepts, and the prefix is parsed once at the boundary into the
  kind, so `show` never guesses which record a bare string named.
- **Record summary** — the short markdown a session pastes onto a card,
  computed as a pure function of one parsed record: for a run its stages,
  grades, verdict, and cost; for a group its reliability summary and cost; for
  a comparison its paired deltas beside the control arm. It is never a second
  record shape: `--json` still prints the strict record's own bytes.
- **Rep** — one repetition of a run; scores are distributions over reps, never
  a single rep. The UI's design's singular **attempt** already matches this
  glossary's Attempt entry and needs no mapping; the design's plural
  **attempts** inside a group is this glossary's rep (decision-5).
- **Rep outcome** — one binary reliability observation. A declared stage
  succeeds with Judge grade A or B; the final outcome succeeds with Judge PASS;
  a session case's rep succeeds when every check in its check list passes. A
  stop or execution failure is unsuccessful.
- **Replay** — re-running one stage from a checkpoint with the current corpus,
  in a fresh worktree.
- **Retained candidate** — the run's final result commit, pinned in the target
  repository under `refs/rehearsal/<run>` before the target is restored, so the
  candidate outlives the run that produced it. Restoring makes the commit
  unreachable and only the ref keeps gc from pruning it;
  `show run:<name> --checkout <dir>` materializes it as a detached worktree.
  It is the same ref a checkpoint is pinned under, named by the run rather than
  by a stage.
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
- **Run event** — one timestamped fact about a run in progress (a stage
  starting, a turn completing, a stage or the run finishing, a run reconciled
  interrupted), appended to the SQLite store one shared database under
  `.benchmark-runs/` holds, keyed by run id. It stays derived per decision-3:
  the run artifact on disk remains authoritative for what a run concluded,
  the event store can be deleted and rebuilt from those records, and a
  reader replays it over the server's SSE endpoint, either live or from the
  start for one attaching mid-run.
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
- **Session naming** — the uuid an attempt gives its own session before the
  call, as the fork's id when resuming and through `--session-id` otherwise. It
  is what lets the attempt name the one session file it owns under its slug, so
  cleanup deletes that file and never an entry it cannot account for, whether
  the call returned or threw.
- **Session knobs** — the CLI and environment settings shared by run and replay
  that select the workflow and Judge models and efforts and set the per-session
  spend limit.
- **Stage** — one pipeline step: a skill invocation consuming upstream
  artifacts and emitting its own. The UI's design calls this a **step**
  (decision-5); the word in code, records, and this glossary stays stage.
- **Stage commit history** — oldest-first subjects of the commits a stage added
  after its baseline; absent when the stage did not advance the target history.
- **Stage scorecard** — persisted Judge result for one stage: its frozen input
  and rubric, citations, grade, prompt, and Judge cost; a rejected scorecard
  also carries its calibration.
- **Stale case** — a session case whose most recent attempt recorded corpus
  file digests that the current corpus no longer matches. It is the session
  kind's counterpart to a stale checkpoint: the same "this measurement no
  longer describes the corpus" claim, keyed on the files the case declared
  rather than on the skill a stage invoked. A case with no attempt is not
  stale, because nothing was invalidated.
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
- **Task graph** — the UI's horizontal chain of stage-node cards (grade,
  status, live tool call, checkpoint, contribution phrase, in/out counts of
  instruction files loaded and artifacts produced) shown on the live monitor
  and, in reduced form, as "the map" on the run-detail Contribution layout.
  A UI concept only; nothing in the harness computes or stores a graph
  (decision-5).
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
