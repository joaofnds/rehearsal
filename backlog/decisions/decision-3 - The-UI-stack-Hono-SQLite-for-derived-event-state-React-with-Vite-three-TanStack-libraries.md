---
id: decision-3
title: 'The UI stack: Hono, SQLite for derived event state, React with Vite, three TanStack libraries'
date: '2026-09-04 14:10'
status: accepted
---
## Context

`docs/design-handoff/SPEC.md` specifies nine screens for a local single-user
tool that reads durable records from disk and watches a run that costs real
money while it is in flight. The repository had no frontend and no server, so
every layer of this was an open choice.

The measurement that settled the storage question, taken from the first real
pipeline run on 2026-09-04
(`.benchmark-runs/2026-09-04T02-09-23.870Z.shape.json`): 49 agent turns across
two provider calls over 102.6 seconds, which is **0.48 events per second**.
Confirmation groups default to 5 reps and the CLI accepts up to 12, so the
realistic ceiling is roughly 20 writes per second across parallel reps. SQLite
in WAL mode handles that by four orders of magnitude.

Reproduce with: load a run record as JSON, sum `turns` and `durationMs` across
`input.transcript.providerCalls`, and divide.

## Decision

**Backend: Hono on Bun.** Typed routing, middleware, and SSE without a
framework's worldview, and its RPC client shares types with the server rather
than having the record shapes redefined by hand in the client.

**Streaming: SSE, not websockets.** The data flows one way, SSE reconnects on
its own, and it is a plain HTTP response.

**Event state: SQLite, and it stays derived.** Bun ships it, so it costs no
dependency. The records on disk remain authoritative for what a run concluded.
SQLite holds the live event stream and anything computed from it, and can be
deleted and rebuilt from the records without losing a grade.

That boundary is the load-bearing part. This project's whole premise is that a
result is trustworthy because its evidence is inspectable on disk; making the
tool's own database the source of truth would put that behind a schema
migration.

RocksDB was rejected: no query language, and every query here is relational
(events joined to steps joined to runs joined to corpus hashes), so it would
become application code to write and maintain. DuckDB was rejected for now: it
is built to scan millions of rows analytically, the comparison screens read
tens, and it would be a second embedded engine beside the SQLite wanted anyway
for operational state.

**Frontend: React with Vite.** Chosen over the house frontend style's stated
primary (Next with Tailwind) and secondary (Tauri with Svelte). Next brings a
server that is redundant when Hono is already serving; Tauri brings Rust and a
native build for something the spec says opens in a browser.

**TanStack Query, Table, and Router.** Query owns server state across nine
screens that read records, poll, and stream. Table does sorting and filtering
headlessly, which suits decision-2 because the markup stays ours. Router gives
typed params for the deep links the spec needs (a run, a step, a layout mode,
expanded evidence).

Form, Virtual, and Store are not adopted. Form has almost nothing to manage
here. Virtual is worth having when a list actually hurts, and 148 records do
not. Store duplicates what Query and Router already hold. Adopting the suite on
principle would make "we use TanStack" a reason to reach for their answer to a
question we do not have.

**Radix primitives** for the dialog focus trap and disclosure semantics, which
the spec is specific about and which are where hand-rolled implementations
break.

**Tokens: CSS custom properties, not Tailwind.** Under decision-2 the lint
check that fails the build on a raw value is one rule over CSS files; with
Tailwind it means policing arbitrary-value escapes (`bg-[#161826]`, `p-[7px]`)
inside className strings, which is harder to write and easier to slip past.
This was the weakest of these calls and rests partly on taste.

**Layout: one repository.** The UI server is a second adapter beside the CLI
over the same harness, so one test runner, one lint config, one commit stream.
Vite is the only added build step and it builds the client only.

## Consequences

The UI reads records through the CLI's own read paths (`listRecords`,
`recordFileFor`, `parseRecordId`) rather than reimplementing record access, so
the id-traversal refusal that guards `show` guards the UI without being written
twice.

The run process gains an event stream it does not have today (ACT-51). Because
the events land in SQLite rather than in process memory, a run survives the UI
being closed, a reader attaching midway gets the whole state rather than only
what follows, and a crashed run leaves something to reconcile on restart.

Deleting the database is a supported operation. Anything it holds that cannot
be rebuilt from the records on disk is a defect in this boundary.

If a later need is scanning thousands of runs for patterns in judge behavior,
DuckDB becomes the right answer, added as a read-only analytical layer over
exported data rather than replacing SQLite.
