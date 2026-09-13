# CLI and harness reference

This reference describes the implemented command and evidence contracts. Start
with the [runbook](runbook.md) for setup and a first run, the [project status](status.md)
for remaining gaps, and the [glossary](../GLOSSARY.md) for domain terms.

## Execution modes

| Request                               | Unit of work                                              | Execution directory                 | Result                               |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| `run --case <pipeline-case>`          | Whole workflow                                            | The target's `main` checkout        | Run artifact or stopped-stage record |
| `run --case <session-case>`           | One Claude session                                        | A fresh temporary attempt directory | Session attempt record               |
| `replay --run <name> --stage <stage>` | One pipeline stage                                        | A fresh target worktree             | Replay record                        |
| Pipeline `run --confirm`              | Repeated whole workflows                                  | Separate target worktrees           | Confirmation group and report        |
| Session `run --confirm`               | Repeated sessions                                         | Separate attempt directories        | Confirmation group and report        |
| `replay --confirm`                    | Repeated stage executions                                 | Separate target worktrees           | Confirmation group and report        |
| `compare <manifest>`                  | Completed stage/pipeline or session confirmation evidence | No execution directory              | Comparison report                    |

A debug attempt helps inspect behavior. Confirmation repeats a frozen input set
and reports reliability and resource use. Comparison consumes existing evidence;
it does not launch agents. Session comparisons use recorded checks and worker
metrics; they do not load pipeline Judges.

## Command interface

Use `mise exec -- bun run rehearsal <command>` from the repository. The entry
point enforces the Bun version in `mise.toml`. `--help` and command-specific
`--help` are generated from [the command declarations](../src/cli/commands.ts),
which are the complete flag reference.

`run` defaults to the `audit-log` case. `--case` or `BENCHMARK_CASE` selects
another. Pipeline runs accept `--target` / `BENCHMARK_TARGET_DIR` and
`--pipeline` / `BENCHMARK_PIPELINE` to override the case. Session cases reject
these flags because they have neither a target repository nor a pipeline.

`run` and `replay` resolve workflow model and per-session budget in this order:
CLI flag, environment variable, case declaration. Missing model or budget is a
usage error. Replay consults the recorded run's case declaration as it exists
today; it can use explicit flags if that declaration no longer exists.

The shared settings are `--model`, `--effort`, `--judge-model`,
`--judge-effort`, and `--session-budget-usd`, with corresponding
`BENCHMARK_MODEL`, `BENCHMARK_EFFORT`, `BENCHMARK_JUDGE_MODEL`,
`BENCHMARK_JUDGE_EFFORT`, and `BENCHMARK_SESSION_BUDGET_USD` variables.
Effort accepts `low`, `medium`, `high`, `xhigh`, and `max`. The provider must
support the selected model and effort combination.

Workflow model and effort also govern the Product Owner. Judges default to
`opus`, or `sonnet` when the workflow model belongs to the Opus family. Judge
effort defaults to workflow effort. Explicitly selecting a Judge from the same
recognized model family prints a self-preference warning. A full model ID can
pin a comparison more precisely than a moving alias.

`--minimum-grade` / `BENCHMARK_MINIMUM_GRADE` defaults to B and controls when
a plain pipeline run continues. Replay and pipeline confirmation do not currently
thread this setting into execution. Lowering it permits further execution; it does not
rewrite the Judge's grade or make a low grade a reliability success.

### Spend and terminal requirements

- An unattended `run` or `replay` needs `--model` or `BENCHMARK_MODEL`.
  A model supplied only by the case declaration is accepted at a terminal.
- `--confirm` defaults to five repetitions. `--reps` requires `--confirm`
  and must be at least two. The projected cost needs interactive approval or
  `--yes`; `--yes` does not replace explicit model selection for unattended use.
- Pipeline `--pause` requires a terminal. Without it, a debug run restores the
  target and leaves review/calibration to separate commands.
- `calibrate --confirm-rejudge` approves revised Judge conclusions. Calibration
  can invoke paid Judges even when the target was restored long ago.

Model availability is checked with a paid probe whose budget ceiling is $0.10.
For pipeline `run`, repository and settings preconditions precede the probe,
but baseline target checks happen afterward. Session execution also probes
before some corpus and transcript validation. A refused input therefore does
not universally mean zero spend.

Before that paid probe, a resumed session case checks local `claude --help` for
`--system-prompt-snapshot <on|off>`. A CLI without that capability is refused;
fresh session cases do not need the check.

The session budget applies separately to workflow sessions, the shared PO
session, and Judge invocations. It is not a whole-run ceiling. Confirmation
projects rep costs from those budgets; session confirmation includes the probe
allowance in its projection. Stage/pipeline projections do not include that
probe allowance. Calibration rejudges are additional calls.

### Output and exit codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| 0    | Command completed; the recorded grade or check outcome may fail       |
| 1    | Execution failure                                                     |
| 2    | Invalid command, flag, or value                                       |
| 3    | Refused precondition, such as missing evidence or a required terminal |

Commands that write a record generally print its path, or its bytes with
`--json`. `show` prints a readable summary for supported record kinds and raw
bytes otherwise; `show --json` prints the selected file's bytes. `list` and
`stale` do not accept `--json`.

Pipeline execution still writes some progress to stdout. Until that routing is
fixed, obtain JSON from the resulting file or `show --json` instead of assuming
that redirecting `run --json` captures a clean JSON document. Diagnostics and
session check summaries use stderr.

## Cases and pipelines

Cases live under `cases/<id>/case.json`. The ID must match the directory name.
Declarations are validated by [case.ts](../src/benchmark/case.ts); pipeline
structure is validated by [pipeline.ts](../src/benchmark/pipeline.ts).

A pipeline case declares task, product brief, final rubric, pipeline, stage
rubric directory, and target path. Input paths are confined to the case; the
target path may leave it and resolves relative to the case directory. An
optional `settingsFile` overrides the committed root `stage-settings.json`.

The task is Markdown with a level-one heading and a nonempty description. The
product brief supplies settled product facts. The final rubric contains unique
IDs in this form:

```text
1. `requirement-id`: Binary requirement text.
```

The final rubric must retain `check-integrity` and `local-checks`, which the
harness resolves from measured results.

A pipeline defines board statuses, an ordered stage list, target setup commands,
target checks, check-integrity files, and a commit-subject pattern. Commands are
argument vectors with optional environment overlays. Stages name a skill,
planning/delivery kind, and stage rubric. A planning stage may require acceptance
criteria and may declare an attached durable document; a card-only planning
stage needs no document attachment. Exactly one delivery stage must come last.
The bundled pipeline is `shape` followed by `build`.

The default stage settings deny branch/worktree creation commands and disable
bundled skills. The allowed settings schema covers a deny list and selected
feature switches; it rejects arbitrary settings keys, including hook blocks.
These settings are harness-owned data, independent of the operator's live
settings file. Pipeline runs, confirmations, and replays pass the canonical JSON
to stage sessions and record its digest in checkpoint or replay lineage. Records
store a control-relative settings path, so moving the checkout does not change
the recorded identity or expose the recording machine's path.

### Session cases

A session case declares a prompt, allowed tools, declared corpus files, and at
least one deterministic check. Optional inputs are a fixture tree, transcript
prefix, inline settings/agent definitions, and `projectFiles` for context
manifest reconciliation. Fixture trees may not contain symlinks.

| Check            | Behavior                                                    |
| ---------------- | ----------------------------------------------------------- |
| `word-band`      | Count reply words against optional `min` and `max`          |
| `forbidden-text` | Fail for declared strings present in the reply              |
| `tool-calls`     | Check transcript tool-call count and optional allowed names |
| `files-read`     | Require declared paths in transcript `Read` calls           |

Checks measure only what the declaration asks. A passing tool-call ceiling does
not establish implementation correctness. A session that returns no reply at a
turn or budget limit records `NO_REPLY` without evaluating checks. Confirmation
counts that rep as unsuccessful; it also records execution failures and missing
metrics explicitly.

`case capture <id> --session <id-or-prefix> --cut <N>` copies records `[0, N)`
from a local Claude transcript, updates the declaration's digest/source/cut,
and writes the prefix under `.benchmark-runs/cases/<id>/`. The cut is a positive
zero-based index of the first dropped record. Run the formatter after capture.

Prefix bytes are ignored local run state. A committed declaration does not make
them available to another clone. The loader uses the prefix store even if a
similarly named file exists inside the committed case directory. Resumption
checks the declared digest, forks the prefix under a fresh session ID, and owns
only the forked session file for cleanup. Its Claude invocation sets
`--system-prompt-snapshot off`, so the system prompt is rendered again from the
case's declared settings and installed corpus rather than reused from the
prefix's original conversation. Missing or changed bytes are refused.

## Corpus sources and delivery

The corpus is the engineer's instruction set. The target's own `CLAUDE.md`,
`AGENTS.md`, and project documents belong to the target. Rehearsal's root
`CLAUDE.md` instructs contributors working on Rehearsal.

A corpus directory has this layout; only the entries needed by an execution
must be present:

```text
CLAUDE.md
skills/<name>/...
output-styles/<name>.md
agents/<name>.md
rulebook/...
```

Absent `--corpus`, the live source permits files under `~/.claude` and one
external backing tree. `BENCHMARK_LIVE_CORPUS_BACKING_ROOT` selects that tree
and defaults to `~/.agents`. An override replaces the default and must be a
non-empty absolute path without NUL bytes. A missing backing tree grants no
permission. Rehearsal checks the backing tree only when a file resolves outside
the live install, so files stored directly under `~/.claude` remain usable when
the optional tree is missing or unreadable.

Live instruction reads, declared-file hashes, stage capture, and corpus layout
reports refuse paths whose real paths leave both permitted trees. Checks cover
each selected layout directory and its entries, including links through a parent
directory. Allowed links may cross layout directories within the permitted
extent. Records retain layout paths and content hashes; real paths authorize
access without changing file identity.

A corpus path selected for reading is refused by name whenever it cannot supply
the directory entries or file bytes its role claims: it escapes the permitted
trees, its link target is missing, its link never resolves, its bytes cannot be
read, or it has the wrong file type. One refusal omits its own layout
directory's files and the whole-corpus digest, and retains healthy directories.

The corpus API returns HTTP 200 carrying those refusals. Refusals name the
corpus path without exposing the outside target or its descendants. Stage
capture fails before the affected workflow runs.

An instruction file the corpus cannot supply, including one it simply does not
hold, is a staleness cause rather than a failure: every checkpoint hashed one,
so those measurements can no longer be reproduced. The run-history API and
`stale` both report it that way, per checkpoint, and keep answering for every
other record.

A declared directory source must exist and contain at least one recognized
layout entry. Rehearsal consumes a directory; rendering a revision from a
dotfiles repository is external work. Directory sources and frozen stage
snapshots permit paths within their own root only. Project-level stage inputs
keep that same boundary even when a live source supplies a fallback. The first
selected directory shadows lower-priority roots; a refused directory cannot
fall through to a different source.

These checks do not constrain hard-linked data, make provider execution a
filesystem sandbox, or prevent a concurrent process from replacing a link
between its check and read. Corpus sources remain trusted experimental inputs.

| Mode                                | Live corpus                                           | Directory supplied with `--corpus`                                                 |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pipeline debug `run`                | Supported                                             | Refused                                                                            |
| Pipeline confirmation               | Frozen stage/global inputs installed in rep worktrees | Refused by `run`                                                                   |
| Stage replay, debug or confirmation | Supported                                             | Supported; installed in the worktree with project settings sources                 |
| Session debug                       | Declared inputs are hashed from the live install      | Declared styles, agents, and rulebook can be overlaid; declared skills are refused |
| Session confirmation                | Declared deliverable files are frozen                 | Declared deliverable files are frozen                                              |
| `stale`                             | Compare against live files                            | Compare against the supplied directory                                             |

Session confirmation refuses declared global `CLAUDE.md` and skills because it
cannot isolate those inputs yet. Session directory overlays write styles,
agents, and rulebook under the attempt's `.claude/`; they do not deliver a
replacement global `CLAUDE.md`. A debug directory case declaring that file must
not be treated as proof that the replacement instructions reached the worker.

A live session debug attempt holds a pointer to the live corpus and hashes it;
it does not freeze a copy. Directory session attempts copy declared inputs,
and session confirmation freezes declared deliverable inputs before its reps.
Only a declared output style is selected; an unrelated style in the source does
not become the measured style.

Stage snapshots include global instructions, the stage's skill, and available
agents, output styles, and rulebook. Snapshotting validates selected inputs
before copying their files, and copies allowed links as ordinary files so the
snapshot remains usable after the original trees change or disappear. The
additional global-skills list is currently empty. Explicit-directory replay and
stage/pipeline confirmation install snapshots under the worktree's `.claude/`,
preserving its root project instructions, and use project settings sources.
Plain live debug replay leaves settings sources unset and does not install a
snapshot. It uses the live agent environment, as a live debug pipeline does.
Consequently, corpus hashes alone do not establish equivalence between all
ambient hooks, memory, and MCP behavior.

## Pipeline execution and grading

A debug pipeline requires a clean control repository and a separate clean target
repository root on `main`, including ordinary untracked files. The harness
claims the target and backs up its managed workflow state: the root Backlog
configuration, `backlog/`, `.backlog/`, `.boris/`, and a configured custom board
path when one exists. It then runs baseline checks, verifies the unchanged clean
baseline, and captures context/integrity bytes.
It then seeds a real Backlog.md task and records an initial checkpoint.

Each stage starts a fresh engineering session with its named skill. Durable
cards, documents, commits, and checkpoints carry work across stages. Stage
sessions have broad tool access and skip permission prompts. Use a dedicated
target whose services and schema already satisfy the case's declared checks.

A shared Product Owner session answers engineering questions using the task and
product brief, retaining earlier decisions. It does not receive the grading
rubric or candidate diff. Its policy preserves stated product facts, chooses
small coherent scope where facts are silent, and leaves implementation choices
to engineering. Questions and answers are recorded.

Planning-stage validation requires clean descendant history on the original
branch and any declared acceptance criteria/artifact. Planning commits become
evidence and advance the next stage's baseline. Delivery requires at least one
commit matching the pipeline's pattern, clean descendant history, and target
checks/integrity. The delivery Judge sees delivery-stage commits; the final
Judge sees the candidate since task setup.

Stage rubrics define hard blockers, binary requirements, and letter-graded
quality dimensions. A blocker yields F; a missing requirement caps the result
at C. Otherwise the worst dimension determines the grade. A/B is the normal
continuation and reliability-success band. `--minimum-grade` can alter pipeline
continuation without changing those Judge conclusions.

The stage Judge receives frozen task, brief, instructions, bounded tracked
repository context, questions/decisions, task state, declared artifact, and
accepted prior artifacts. Delivery adds diff and measured checks. Binary files,
`bun.lock`, and content beyond configured capture limits are excluded from full
context. Harness-detected delivery/check failures force blockers.

Judges run with safe mode and no tools. Output must satisfy schemas, evidence
citations, and grade derivation. Invalid returned output gets one correction
attempt against the same evidence; invocation/envelope failures are not retried.
Scorecards retain the prompt, frozen rubric/input, returned attempts, validation
outcomes, and costs.

After accepted delivery, the final Judge grades the external rubric against
baseline context, the candidate diff, and measured checks. Requirement IDs must
appear exactly once, citations must refer to supplied evidence, and PASS needs
all requirements. The harness overrides `local-checks` and `check-integrity`
with its own measurements. Target integrity files must exist at baseline and
retain their bytes, preventing a candidate from passing by weakening checks.

## Review and calibration

Without `--pause`, a pipeline debug run retains its candidate under
`refs/rehearsal/<run>`, restores the target, and prints the record and follow-up
commands. A completed candidate awaits human review; a quality stop records the
stage evidence that stopped it. Review remains separate from the machine grade.

`show run:<name> --checkout <new-directory>` creates a detached worktree in the
recorded source repository from the retained ref. The directory must not exist.
Remove the checkout with `git worktree remove` afterward. The retained ref keeps
candidate commits reachable after target restoration.

`review <run>` accepts either `--file <review.json>` or `--verdict`, `--summary`,
and repeated JSON `--finding` flags. It validates the run and review before
writing `<run>.review.json`. This hypothetical finding uses the bundled final
rubric. Replace its path and description with evidence from the actual candidate:

```json
{
	"verdict": "REJECT",
	"summary": "The persisted audit row omits details.",
	"findings": [
		{
			"description": "The worker does not persist the payload details.",
			"paths": ["src/audit/worker/audit.worker.ts"],
			"stage": "final",
			"judgeAssessment": "MISSED",
			"rubricId": "entity"
		}
	]
}
```

| Assessment       | Calibration meaning                                                 |
| ---------------- | ------------------------------------------------------------------- |
| `CAUGHT`         | Original Judge already failed the cited criterion                   |
| `MISSED`         | Revised rubric must catch a defect the original Judge missed        |
| `FALSE_POSITIVE` | Revised rubric must pass behavior the original Judge wrongly failed |
| `NOT_PROMOTED`   | Record the observation without making it a reusable Judge rule      |

`stage` names a stage or `final`; omission defaults to `final` for compatibility.
The first three assessments require `rubricId`. ACCEPT cannot include a CAUGHT
or MISSED defect. Edit the relevant stage rubric or final rubric for Judge
errors, and the measured instruction corpus for observed agent-behavior defects.

`calibrate <run>` reads the review, current rubrics/instructions, and frozen
recorded evidence. Changed stage rubrics rejudge the same stage input; a changed
final rubric rejudges the same candidate when final evidence exists. No new
implementation run is required. A final-rubric edit at a stage stop cannot
produce a final grade for a pipeline that never reached delivery.

Calibration checks findings against original and revised judgments. Revised
conclusions require `--confirm-rejudge`; without it, the command prints the
revision, leaves the record unchanged, and exits 3. Running again to confirm
invokes the Judges again against current inputs and incurs those calls again.
Invalid reviews or ineffective rubric changes leave the record uncalibrated.
A successful calibration records COMPLETE with the review and revised evidence.

With `--pause`, the candidate stays in the target, a review template is created,
and the interactive loop waits until review and calibration validate. Changes
to corpus/rubrics made during review remain after target restoration.

Completed calibration contributes Judge/human contingency counts per exact
Judge model, stage, frozen rubric contract, and criterion. Reports include
observed agreement and Cohen's kappa; kappa is null when its denominator is zero.
Changing the model or rubric starts a distinct agreement baseline.

## Target restoration

Normal direct-target cleanup force-switches to `main`, resets to the original
SHA, cleans ordinary untracked files, restores the workflow paths recorded in
the pre-run backup, then verifies the original clean state before removing the
run marker and backup. Candidate commits survive through retained refs. Ignored
dependency/build folders outside the workflow paths are not restored byte for
byte. Repository-private Backlog exclude entries remain in Git metadata after
restoration and are reused by later runs.

SIGINT, SIGTERM, and SIGHUP stop child process groups and trigger restoration.
A hard kill or crash may leave `.git/benchmark-run.json` and a temporary workflow
backup. The next run refuses that target. Follow its recovery instructions:
stop surviving children, restore the recorded Git state and workflow backup,
verify recovery, and only then remove the marker. Server interruption detection
does not perform that restoration for you.

An initial checkpoint captures task setup and the stage-settings digest;
accepted stages create subsequent checkpoints with target SHA, workflow state,
artifacts, settings, and lineage. Replay materializes the upstream state for the
named stage. It can inspect a stale checkpoint for exploration, while
confirmation/comparison require compatible frozen evidence. Replay permits an
uncommitted control repository and records its SHA with a dirty marker.

`stale` compares recorded corpus inputs with live or supplied corpus files and
compares each pipeline run with the stage settings its case declares today.
The root `stage-settings.json` applies when a case declares no override or no
longer loads as a pipeline case. The comparison uses canonical JSON, so
whitespace-only edits and checkout relocation remain fresh. A missing or invalid
current settings file stales that run by name without hiding other runs. The
initial checkpoint participates, including for runs that stopped before an
accepted stage. Optional model/effort flags assert those intended replay
settings as well. A session case with no prior attempt has no stale measurement.
Missing files and changed inputs are evidence to inspect, not a substitute for
running the revised case.

Ordinary checkpoints created before settings evidence was recorded appear stale
even when the settings file has not changed. Their records cannot show that the
currently declared settings applied to those stage sessions.

## Record locations and IDs

The authoritative evidence lives under ignored `.benchmark-runs/`. The SQLite
run-event store supports live UI updates and is derived state.

| ID accepted by `show`                 | Record location under `.benchmark-runs/`                    |
| ------------------------------------- | ----------------------------------------------------------- |
| `case:<id>`                           | Declaration is outside run state, at `cases/<id>/case.json` |
| `run:<name>`                          | `<name>.json`, or the stopped-stage record                  |
| `checkpoint:<run>/<stage>`            | `<run>.checkpoints/<stage>/checkpoint.json`                 |
| `attempt:stage:<lineage>/<timestamp>` | `replays/<lineage>/<timestamp>.json`                        |
| `attempt:session:<case>/<uuid>`       | `sessions/<case>/<uuid>/attempt.json`                       |
| `group:<group-id>`                    | `confirmations/<group-id>/group.json`                       |
| `comparison:<digest>`                 | `comparisons/<digest>/report.json`                          |

`list cases|runs|checkpoints|attempts|groups|comparisons` prints IDs usable by
`show`. Empty history is valid on a fresh clone. A malformed record is reported
without hiding readable neighbors. Stopped runs are visible through the same
commands as completed runs.

Confirmation groups retain frozen inputs, rep records, and `report.json` beside
`group.json`. Reps run concurrently in separate directories. Reports include
outcomes, success rates and uncertainty, pass^k, and resource distributions;
a failed or stopped rep remains part of that evidence. Session reports also
record the model probe and missing provider metrics explicitly.

## Comparison manifests

`compare` requires at least two distinct cases, each with baseline, candidate,
and minimal-corpus control arms. Each path names a completed stage, pipeline, or
session confirmation `group.json` and resolves relative to the manifest. Session
groups must carry one frozen case declaration, their recorded attempt evidence,
and a corpus inventory matching that declaration. The control corpus may be
empty for a session case. The control corpus is supplied by the operator. For
example:

```json
{
	"schemaVersion": 1,
	"cases": [
		{
			"caseId": "case-1",
			"arms": {
				"baseline": "groups/case-1-baseline/group.json",
				"candidate": "groups/case-1-candidate/group.json",
				"control": "groups/case-1-control/group.json"
			}
		},
		{
			"caseId": "case-2",
			"arms": {
				"baseline": "groups/case-2-baseline/group.json",
				"candidate": "groups/case-2-candidate/group.json",
				"control": "groups/case-2-control/group.json"
			}
		}
	]
}
```

The loader checks schemas, frozen-file hashes, rep records, controlled inputs,
mode/stage consistency, and corpus identity across cases before writing a
report. Within a case the arms must preserve the controlled experiment inputs,
including model, effort, budget, and non-corpus evidence. A changed corpus is
the treatment. Session checks are read from the recorded attempt and must agree
with the frozen case declaration; no final-outcome row is synthesized. Debug
attempts cannot substitute for confirmation groups.

Statistics are recomputed from rep evidence, rather than copied from existing
confirmation reports. The output at `comparisons/<manifest-sha256>/report.json`
contains quality/resource contrasts for candidate minus baseline, candidate
minus control, and baseline minus control, with Judge agreement context. Session
reports use schema version 3, retain an attempt path and hash beside every
source repetition, and carry an empty Judge-agreement baseline.
`compare --json` prints the report bytes without starting provider sessions.
Session resource values are per-repetition worker metrics; group preflight cost
remains at confirmation-group level, and unavailable metrics stay visible as
unavailable.
