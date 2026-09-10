# Current state and priorities

Reviewed against the code and project board on **2026-09-11**. This is the public
feature inventory, not a release guarantee. The [vision](vision.md) describes the
longer-term goal; the [runbook](runbook.md) describes the supported first steps.

The project has moved beyond its original NestJS benchmark into a general
instruction-corpus experiment harness. Its CLI can run and repeat experiments,
replay stages, retain grading evidence, and read records. The public onboarding
path is a session case with a small supplied corpus. Complete workflow operation
still requires environment-specific setup.

## Implemented

| Capability                  | Current boundary                                                                                               | Source                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Data-declared cases         | Session and pipeline kinds; bundled inputs have differing portability                                          | [Case loader](../src/benchmark/case.ts)                                                                                            |
| Session attempts            | Fixture/prefix support and deterministic reply/transcript checks                                               | [Session execution](../src/benchmark/session-attempt.ts)                                                                           |
| Session confirmation        | Repeated frozen inputs, retained failures, per-attempt checks, projected ceiling including model preflight     | [Session confirmation](../src/benchmark/session-confirmation.ts)                                                                   |
| Pipeline execution          | Configured stages, portable private-board setup, dynamic PO, Judges, baseline checks, calibration, restoration | [Run orchestration](../src/benchmark/run.ts)                                                                                       |
| Checkpoint replay           | One stage in a host worktree, including explicit corpus variants                                               | [Replay command](../src/cli/replay-command.ts)                                                                                     |
| Pipeline/stage confirmation | Repetitions with shared frozen inputs and resource/reliability reports                                         | [Pipeline confirmation](../src/benchmark/pipeline-confirmation.ts), [replay confirmation](../src/benchmark/replay-confirmation.ts) |
| Comparison reports          | At least two cases with baseline/candidate/control arms; stage, pipeline, and provider-free session evidence   | [Comparison loader](../src/benchmark/comparison-loader.ts)                                                                         |
| Record inspection           | Cases, runs including stopped stages, checkpoints, attempts, groups, comparisons, and staleness                | [CLI commands](../src/cli/commands.ts)                                                                                             |
| Local read UI and event API | Partial browser views and server-side event streaming                                                          | [Router](../client/src/router.tsx), [API](../src/server/api.ts)                                                                    |

An implemented path can still have missing real-provider validation. Session
comparison uses existing ACT-140 records and a provider-free integration path;
the browser view reads the same saved report as stage and pipeline comparisons.

## Known limitations

- **Session comparison does not isolate new inputs.** It consumes the frozen
  case, fixture, transcript, and corpus rows already written by confirmation.
  Global `CLAUDE.md` and skills remain refused by session confirmation until
  their isolated delivery work lands.
- **Session corpus isolation is partial.** Confirmation refuses declared global
  `CLAUDE.md` and skills. A directory-backed debug session also cannot deliver
  a skill variant, and its global instruction file is not overlaid. Live debug
  runs can read mutable installed files. See the [support matrix](reference.md#corpus-sources-and-delivery).
- **Corpus containment is a read boundary.** Declared inputs, stage capture,
  `stale`, and the corpus API check layout roots and entries against their
  source extent. Live sources allow the install and configured backing tree;
  directory sources and frozen snapshots stay within their own root. These
  checks do not constrain hard-linked data, sandbox provider tools, or prevent
  concurrent link replacement. Some unreadable or looping layout entries still
  fail the report rather than produce a named refusal.
- **Pipeline `run --corpus` is refused.** Replay supports explicit corpus
  directories, but the forward pipeline command does not yet use that path.
- **Several cases depend on private inputs.** `brief-reply-*` need ignored
  transcript prefixes; `smoke` needs an output style; doctrine examples need
  installed corpus files. `manifest-probe` also needs its prefix in the runtime
  transcript store even though a reference copy exists under `cases/`.
- **Session output grading is narrow.** Checks currently read the reply and tool
  transcript. Generated fixture setup, post-session filesystem/Git preservation,
  and command scorers are planned. A doctrine example's tool-call check is not
  evidence that its implementation is correct.
- **Pipeline progress can mix with JSON stdout.** Read the saved record or use
  `show <id> --json` when consuming pipeline evidence programmatically.
- **Context and cost coverage have limits.** Pipeline raw transcript capture is
  unfinished, event streaming is coarse progress rather than token streaming,
  and missing provider metrics must remain visible as missing. Review the
  recorded evidence before drawing attribution or price conclusions.

## Browser UI

| Route                   | Available today                                                      |
| ----------------------- | -------------------------------------------------------------------- |
| `/`                     | Run-history report, including empty and error states                 |
| `/corpus`               | Live corpus inventory; instruction editing is marked planned         |
| `/comparisons/<digest>` | Saved comparison's attempt-pair view; “What moved” is marked planned |
| `/system`               | Design tokens and reusable component gallery                         |

Run launch, live monitor, full run detail, task/case management, calibration
screens, settings, and first-run setup are design targets. The SSE API already
exists, but a completed live-monitor screen does not. The server has no
authentication and no explicit loopback-only bind; use it locally.

## Near-term priorities

The board's goals are to let a second person run an experiment, distinguish an
instruction improvement from noise, watch a run's spend, and read a comparison
well enough to decide whether an edit helped. The remaining work follows those
goals:

1. Validate the saved session comparison through the browser view and add
   reproducible public pipeline case inputs.
2. Deliver isolated session skill variants, generated fixtures, and preserved
   post-session state so realistic skill outcomes can be graded.
3. Complete the evidence needed for useful UI views, including pipeline
   transcripts, live run monitoring, and comparison explanations.
4. Tighten corpus-source containment and measurement boundaries without
   claiming that host execution is a sandbox.

These are contribution areas, not a fixed delivery schedule. For concrete entry
points, inspect the linked modules and their neighboring tests, then follow
[Contributing](../CONTRIBUTING.md). The personal board's historical card numbers
may appear in code diagnostics, but public readers need no board access to
understand the limitations described here.
