# Prompt for Claude Design

Paste everything below the line.

---

Design the UI for a local desktop-class web app called **Rehearsal**. It runs
on the developer's own machine, opens in a browser, and is used by one person:
the engineer who owns the instruction corpus it measures.

## What the tool does, so the screens make sense

An engineer writes instructions for their coding agent: a project `CLAUDE.md`,
skills that own each stage of their workflow (shape, build, review), and rubrics
that grade results. They keep editing those instructions and have no way to know
whether an edit made the agent's work better or worse, because they never repeat
the same task twice.

Rehearsal fixes that. It replays a frozen task against the current instructions,
grades the result, and compares runs. The vocabulary:

- **Case** — a frozen benchmark task, declared as data. Two kinds. A *pipeline*
  case runs a multi-stage workflow against a real target repository. A *session*
  case runs one agent session and judges its reply with deterministic checks.
- **Pipeline** — the ordered stages a pipeline case runs (for example shape,
  then build). Each stage is an agent session followed by a judge.
- **Run** — one execution of a case. It either completes or stops when a stage
  is graded below the minimum.
- **Stage** — one step of a run: the agent session, its artifacts, and the
  judge's verdict with a letter grade (A to F) and a reasoned scorecard.
- **Checkpoint** — the frozen state after an accepted stage, so a later run can
  resume from it instead of paying for the stages before it.
- **Replay** — re-running one stage from a checkpoint against edited
  instructions. This is the core loop.
- **Corpus** — the instruction files under test. Every run records exactly which
  files it read and their content hashes.
- **Stale** — a recorded result whose corpus files have changed since, so the
  result can no longer be trusted.
- **Comparison** — a report over two or more runs, showing whether an
  instruction edit moved the score.

## The screens

Design these, desktop-first, as one app with persistent navigation.

**1. Monitor** — a run in flight. This is the screen the user watches while
spending money. It must show, live: which stage is running, the agent's output
streaming in, the cost accumulating against the budget they set, and the elapsed
time. When a stage finishes, its judge verdict appears with the grade. When a
stage is graded below the minimum, the run stops and the target repository is
restored, and the screen has to make clear that stopping is a normal outcome
rather than a crash. A run can be interrupted and resumed, so this screen also
has to represent a run that was interrupted and reconciled on restart.

**2. Runs** — the history. Every past run, its case, its outcome, its grade per
stage, what it cost, and whether it is stale. The user scans this to find the
run they want to compare or replay from.

**3. Run detail** — one run opened up. The stages in order, each with the
agent's artifacts, its transcript, and the judge's scorecard: the letter grade,
the hard blockers that fired, the quality dimensions graded independently, and
every piece of evidence the judge cited with the source it came from. This is
where the user decides whether the judge was right, so the judge's reasoning has
to be readable rather than a JSON dump.

**4. Compare** — two runs side by side, showing the per-stage grade delta and
the cost delta, with the instruction diff that separates them. The question this
screen answers is "did that edit help".

**5. Corpus** — the instruction files under test, which files each stage reads,
and which recorded results a pending edit would invalidate. Editing a file here
is reviewed before it is applied.

**6. Cases** — the declared benchmark cases, each showing its kind, its target,
its pipeline or its checks. Starting a run begins here, and starting one asks
for the model, the reasoning effort, and a spend limit before it will proceed.

## Design constraints

- **Dense, not sparse.** This is a tool for one expert user reading a lot of
  structured detail. Favor information density over whitespace. Think Linear,
  Datadog, a CI dashboard. Not a marketing page.
- **Money is always visible.** Every run costs real dollars. Cost appears
  wherever a run does, and the app asks before spending.
- **Grades are the primary signal.** A to F per stage, plus a verdict of
  CONTINUE or STOP. Color alone must never carry that meaning: pair it with the
  letter and a shape or icon.
- **Stale is a first-class state**, not an error. A stale result is still
  readable, but the UI must never let it be mistaken for current.
- **Long-running and interruptible.** Runs take minutes and can be interrupted.
  Every run-related surface needs a representation for in-flight, stopped,
  completed, and interrupted-then-reconciled.
- **Dark mode primary**, light mode supported.
- **Monospace for identifiers**, hashes, file paths, and grades. A proportional
  face for prose.
- Accessibility floor: real semantic structure, visible keyboard focus on every
  interactive element, and no meaning carried by color alone.

## What to produce

Screens 1, 2, and 3 first, at desktop width, since those are the ones the user
lives in. Then 4, 5, and 6. Include the empty state for each, because a new
install has no runs at all, and the first thing a new user sees is nothing.
