# Runbook: driving rehearsal yourself

Everything here is a command you run. No step needs a session.

The point of the tool: change an instruction, and find out whether the change
made your agent's work better or worse. Everything below builds to that.

## The page

```bash
bun run ui
```

Open http://localhost:4173. It lists every record on disk by kind, and each
one links to its own JSON. Records the tool cannot read appear as unreadable
with the reason, rather than breaking the listing the way the CLI does.

It reads only. Runs still start from the commands below.

## 0. One-time check

```sh
mise install
bun install --frozen-lockfile
```

Then confirm the tool sees its cases:

```sh
bun run rehearsal case list
```

Six cases. Five are `session` cases (cheap, seconds, cents). One is a
`pipeline` case, `audit-log`, which runs a full workflow against the NestJS
template and costs real money.

## 1. See it work, for about a cent

Start here. This is the smallest thing that proves the tool runs at all.

```sh
bun run rehearsal case show smoke --json
```

That prints the case: a prompt, and two deterministic checks (reply at most one
word, no tool calls). Without `--json` you get only the declaration's path.
Now run it:

```sh
bun run rehearsal run --case smoke --model sonnet --session-budget-usd 1
```

Both `--model` and `--session-budget-usd` are required; the case declares
neither, and the run refuses with exit 2 if either is missing.

It prints one line per check and then the record's path:

```text
PASS word-band: 1 words within at most 1
PASS tool-calls: 0 tool calls
/Users/joaofnds/code/rehearsal/.benchmark-runs/sessions/smoke/<uuid>/attempt.json
```

Verified 2026-09-04: 0.049 USD, 2.6 seconds. Read the record:

```sh
bun run rehearsal list attempts
bun run rehearsal show attempt:session:smoke/<uuid>
```

The record holds the prompt, the reply, the checks with a pass or fail each,
the model, the corpus files with their digests, and what the call cost.

That is the whole shape of the tool in one cheap run: a declared case, a real
session, deterministic judgment, a record you can read.

## 2. See it catch a corpus change

This is the loop the tool exists for, at session-case scale.

The four `brief-reply-*` cases replay real turns from your own sessions and
check the reply against the word band you actually accepted. They declare
`output-styles/brief.md` as the corpus they measure.

Ask which recorded work a corpus edit has already invalidated:

```sh
bun run rehearsal stale
```

Run on 2026-09-04 this printed:

```text
case:brief-reply-92b2e8b0	output-styles/brief.md changed
```

That recorded result was produced against a version of `brief.md` that no
longer matches the live file, so the tool refuses to treat it as current. Edit
`~/.claude/output-styles/brief.md` and more cases join the list. Nothing comes
back when everything on disk still matches the corpus that produced it.

To ask the same question about a corpus you have not installed:

```sh
bun run rehearsal stale --corpus <a directory in corpus layout>
```

This is the invalidation graph, and it is the part of the tool that makes the
rest honest: it knows which of your recorded results a given instruction edit
made untrustworthy.

## 3. Run the full pipeline

Real money. Roughly 0.50 to 3 USD depending on how far it gets.

First, make the target green. This is not optional and nothing checks it for
you yet:

```sh
cd /Users/joaofnds/code/nest/template
docker compose up -d
CONFIG_PATH=src/config/test.yaml bun run migrate up
CONFIG_PATH=src/config/test.yaml bun run test:unit
```

Expect `20 pass, 0 fail`. If you see `ECONNREFUSED`, Postgres is not up. If you
see `relation "user" does not exist`, the migration did not run.

Then, from this repository, commit anything outstanding (the harness refuses a
dirty control repo, deliberately: it is what pins which corpus produced the
score), and run:

```sh
bun run rehearsal run --case audit-log --model sonnet --effort medium --session-budget-usd 4
```

It prints its progress as it goes: baseline checks, then each stage's session,
then that stage's judge. A stage graded below B stops the run and restores the
target.

Stopping is a normal outcome, not a crash. The run on 2026-09-04 stopped at
shape with an F, cost 0.43 USD, and produced five defect reports. That is the
tool doing its job.

## 4. Read what happened

```sh
bun run rehearsal list checkpoints
bun run rehearsal list attempts
```

Run records currently land at `.benchmark-runs/<id>.<stage>.json` for a stopped
run, and `list runs` cannot find them (ACT-44). Until that is fixed:

```sh
ls .benchmark-runs/
```

The record is JSON. The fields worth reading first are `status`, `error`, and
`input.harnessFailure`.

## What is not yet true

Honest list, so nothing here surprises you mid-run.

- Nothing verifies the target is green before spending (ACT-45). Step 3 does it
  by hand.
- A stopped run is invisible to `list runs` and `show` (ACT-44).
- The harness installs this repository's `CLAUDE.md` into the target as the
  target's project instructions, so a pipeline agent is told the wrong stack
  (ACT-41). Pipeline scores are not trustworthy until this is fixed.
- A run record omits the judge's cost, so the reported price is low (ACT-43).
- One error message covers three different baseline failures (ACT-42).
- `compare` needs at least two confirmation groups, so the corpus A/B report is
  not reachable from a single debug run.
