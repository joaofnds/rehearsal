# Recovered: the benchmark-operations UI

There was a UI for this project. It was designed, planned across milestones,
and built as a running NestJS server rendering a React client. It was never
committed to git, and it was destroyed when the project was renamed from
`template-ops` to `rehearsal` on 2026-08-29 and the board was cleared.

What is here was carved out of opencode's snapshot store on 2026-09-04, from a
git object directory whose backing repository (`~/code/template-ops/.git`) no
longer exists. Ten of forty-nine source files survived. The rest are named
below and their contents are gone.

Nothing here is wired into the current codebase. It is evidence, not code.

## Where it came from

`~/.local/share/opencode/snapshot/7a6af9f8.../2c0d90b6...` holds 2936 trees and
1168 blobs and no commits. The trees preserve every filename; most blobs were
only ever reachable through the deleted repository via
`objects/info/alternates`. So the layout survives in full and most of the code
does not.

The mockup the browser could not open,
`backlog/docs/benchmark-operations-ui-mockups.html`, is not in the snapshot,
not in any of the 64 Claude transcripts for this project, and not in this
repository's 531 commits. It is gone.

## What the design was

Read off the recovered imports and the surviving file names, not from memory.

A NestJS application serving a React client rendered with
`renderToStaticMarkup`, bundling `src/client/application.tsx` through
`Bun.build` at startup, with self-hosted fonts (Atkinson Hyperlegible, Familjen
Grotesk, IBM Plex Mono). `start-application.ts` declares a `BrowserLauncher`
port, so starting the server opened a browser.

The parts, by directory:

- `benchmark-definition` — the case/pipeline declaration, served to the client.
- `client` — the React application. No file from it survives; only its
  entrypoint path, `src/client/application.tsx`, and the `ApplicationShell`
  import in `app-module`.
- `control-repository` — a `ControlChangeService` and a `control-change-set`,
  plus an `InstructionReviewRunner` with a Claude-backed implementation and a
  `ControlApplyBarrierEvent`. This is corpus editing from inside the UI, with a
  barrier around applying a change.
- `evidence` — `EvidenceIngestion`.
- `operations`, `process` — a `StreamingProcessRunner`, so process output
  streamed to the client rather than being read after the fact.
- `run-archive` — a `RunHistoryService` over a `legacy-run-reader`, and a
  `RunHistoryController`.
- `run-execution` — `RunCoordinator`, `PipelineLifecycle`, a `budget-ledger`,
  `run-event` and `run-state`, an SSE-shaped `event-controller`, a
  `restoration-controller`, and `startup-reconciliation`.
- `storage` — SQLite with ten numbered migrations (below), a
  `private-storage-path`, and a migration runner.
- `target-repository` — `target-preflight`, `target-setup`,
  `target-restoration`, `workflow-baseline`, each with a barrier type.
- `workflow` — `claude-session-adapter`, `workflow-stage-runner`,
  `stage-judge-runner`, `final-judge-runner`, `product-owner-runner`,
  `stage-evidence-collector`.

The migration names are the clearest record of what the UI grew to hold:

    0001-local-foundation
    0002-durable-runs
    0003-run-preflights
    0004-pipeline-authorizations
    0005-workflow-baselines
    0006-run-events
    0007-workflow-transcripts
    0008-judge-lifecycle
    0009-evidence-convergence
    0010-run-lifecycle-context

`durable-runs`, `run-events`, and `startup-reconciliation` together mean a run
survived a server restart and the UI reconciled what it found on the way back
up. `pipeline-authorizations` means the UI asked before spending.

## The documents, all lost

Named in transcripts, contents unrecoverable:

    doc-1  benchmark-operations-ui-spec
    doc-2  benchmark-operations-ui-options
    doc-3  benchmark-operations-ui-grilled
    doc-4  benchmark-operations-ui-design
    doc-5  plan-milestone-1
    doc-6  plan-milestone-2
    doc-7  plan-milestone-3
    doc-8  plan-milestone-4
    doc-9  plan-milestone-5
    doc-10 grilled-take-2
    doc-11 plan-milestone-3a
    doc-12 plan-milestone-3b
    doc-13 milestone-3-review
    doc-14 plan-milestone-4a
    doc-15 plan-milestone-4b
    doc-16 plan-milestone-4c
    doc-17 plan-milestone-4d
    benchmark-operations-ui-milestone-3a-evidence
    benchmark-operations-ui-milestone-3b-evidence
    benchmark-operations-ui-mockups.html
    benchmark-operations-ui-mockup-assets/

## What survived

    src/benchmark/backlog.ts
    src/run-execution/pipeline-lifecycle.ts
    src/run-execution/run-coordinator.ts
    src/server/start-application.ts
    src/storage/migrations/0010-run-lifecycle-context.ts
    src/storage/sqlite-storage.ts
    src/target-repository/target-setup.ts
    src/workflow/claude-session-adapter.ts
    src/workflow/stage-evidence-collector.ts
    src/workflow/workflow-stage-runner.ts

`start-application.ts` is the most useful of them: its import list names almost
every module the application had, which is how the inventory above was built.

## The lesson worth keeping

This work was lost because it lived only in the working tree and the board, and
the rename cleared both. The current repository commits its board, which is why
the last week survived the same kind of event. Anything that matters gets
committed, including documents.
