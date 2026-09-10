# Architecture

Rehearsal is a TypeScript application on Bun. Its CLI launches experiments and
writes local evidence. A Hono server exposes that evidence to a React client.
The [vision](vision.md) describes the intended measurement loop; [current state](status.md)
records the gaps in its implementation.

## Components

| Location                              | Responsibility                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`rehearsal.ts`](../rehearsal.ts)     | Bun version gate and command dispatch                                                         |
| [`src/cli/`](../src/cli/)             | Command definitions, argument policy, terminal gates, output, and harness wiring              |
| [`src/benchmark/`](../src/benchmark/) | Case loading, provider invocation, execution, grading, checkpoints, records, and comparisons  |
| [`src/server/`](../src/server/)       | Read API, derived reports, event streaming, startup reconciliation, and static client serving |
| [`client/src/`](../client/src/)       | React routes and shared design system                                                         |
| [`cases/`](../cases/)                 | Benchmark declarations, fixtures, tasks, and rubrics                                          |
| `.benchmark-runs/`                    | Local evidence, captured prefixes, confirmation groups, comparisons, and event database       |

Zod validates case and record boundaries. Bun's test runner covers the harness
and server; the client suite uses a DOM environment. The current client uses
TanStack Router and Query, with a typed Hono client for API requests. Package
versions and scripts belong to [package.json](../package.json).

## Execution paths

```text
CLI → case + flags + preconditions
        ├─ session → temporary directory → deterministic checks → attempt
        ├─ pipeline → target main → stages + Judges → run + checkpoints
        └─ replay → checkpoint worktree → one stage + Judge → attempt

--confirm → freeze shared inputs → isolated repetitions → group + report
compare   → existing stage/pipeline groups → validated comparison report

JSON records → Hono read API → React views
Run events  → SQLite store → SSE endpoint
```

A debug pipeline runs directly on the target's clean `main`. It seeds a task,
records an initial checkpoint, runs the declared stages, and records further
checkpoints after accepted stages. The default pipeline is `shape → build`.
Each stage starts a fresh worker session. A shared Product Owner session answers
questions from the task and product brief. Stage Judges see frozen evidence and
rubrics, and the final Judge evaluates the delivered candidate.

The target owns its project instructions. The harness no longer installs this
repository's `CLAUDE.md` into the target. Normal cleanup restores the original
Git state and backed-up workflow directories. Retained Git refs keep candidate
and checkpoint commits available afterward.

Replay materializes a stage's input checkpoint in a host worktree. It runs only
that stage and preserves its result as another attempt. Pipeline and replay
confirmation use separate worktrees for repetitions. Host worktrees retain real
agent CLI behavior but use different paths, so path-dependent state can differ
from the original checkout. They are not sandboxes for arbitrary host actions.

Session cases use temporary directories seeded with optional fixture files and
conversation prefixes. Their current checks consume replies and tool calls.
They do not yet grade or preserve the final filesystem as a reusable result.
Session confirmation freezes supported inputs once and retains each repetition,
including unsuccessful and execution-failed attempts.

## Instruction and evidence identity

The control repository holds the harness and case definitions. The corpus under
evaluation comes from `~/.claude` or an explicit directory in corpus layout.
A target's own instructions are separate project inputs.

Checkpoints record source commits, workflow state, artifacts, corpus digests,
and lineage. A changed upstream input, model, or effort changes the conditions
under which a result was produced. `stale` reports mismatches for recorded
checkpoints and session debug attempts. Comparison loading checks compatible
inputs and derives its statistics from rep records rather than trusting a saved
summary.

Corpus hashing and delivery are distinct responsibilities. A live debug session
can retain a reference to installed files rather than a frozen copy; a session
confirmation must copy and deliver its supported declared files. Replay can
install stage corpus snapshots using project settings. The complete support
matrix is in the [reference](reference.md#corpus-sources-and-delivery).

Do not treat an instruction being declared or hashed as proof the provider
loaded it. Session context manifests reconcile declared inputs with transcript
observations, within what those transcripts expose. Pipeline transcript capture
and complete context attribution remain unfinished.

## Persistence and recovery

JSON artifacts are authoritative evidence for a completed attempt or run. They
retain grading inputs, outcomes, provider metrics when available, and failures.
Record schemas are versioned where their contracts differ. Readers preserve
supported historical formats rather than rewriting old evidence.

The SQLite database at `.benchmark-runs/run-events.sqlite` stores progress
notifications. The server streams those through `/api/runs/:run/events` and
reconciles abandoned processes at startup. Event recording is best effort; it
must not turn a successful experiment into a failed one. It is not a substitute
for the final artifact. There is no command that reconstructs a deleted event
history from JSON records.

See [record formats and target restoration](reference.md) for storage paths,
identifiers, retained candidates, and recovery boundaries.

## Browser boundary

The production server serves `client/dist` and the API from one origin. The API
reads runs, corpus information, saved comparisons, raw records, and events.
Current routes are listed in [UI coverage](status.md#browser-ui). The client does
not yet drive paid execution or implement the full design prototype.

[The design handoff](design-handoff/README.md) governs visual direction. Its
screen labels map `task` to the harness's `pipeline`, `step` to `stage`, and
`group` to `confirmation run`. Keep that translation at the UI boundary.
Shared tokens and components live under `client/src/system/`; new screens should
extend that system instead of defining independent visual conventions.
