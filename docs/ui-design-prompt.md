# Prompt for Claude Design

Paste everything below the line.

---

Design the interface for **Rehearsal**, a tool that runs locally on a
developer's own machine and opens in their browser. One user: the engineer who
owns the instructions it measures.

## The problem it exists to solve

Engineers write instructions for their coding agents: a project instruction
file, skills that own each stage of their workflow, rubrics that grade the
output. They keep editing those instructions on a hunch, and they never find out
whether an edit helped, because they are never working on the same task twice.
There is no way to attribute a better or worse outcome to a specific change.

Rehearsal is a benchmark harness for an instruction corpus. It freezes a task,
runs an agent against it under a known set of instructions, grades the result,
and lets the engineer change one instruction, run it again, and see what moved.
A single run is never presented as a score, because identical reruns of the same
task vary severalfold.

## What the tool can do today

- Declare a benchmark case as data. Two kinds exist: one runs a multi-stage
  workflow against a real target repository, the other runs a single agent
  session judged by deterministic checks over its reply and its transcript.
- Run a case. Each stage is an agent session followed by an independent judge
  that returns a letter grade (A to F), a verdict of continue or stop, hard
  blockers that either fired or did not, quality dimensions graded separately,
  and every piece of evidence it cited with the source it came from. A stage
  graded below the minimum stops the run and restores the target repository to
  where it started.
- Record a checkpoint at every accepted stage, holding the frozen state that
  stage produced.
- Replay a single stage from a checkpoint against the current instructions,
  instead of paying for every stage before it.
- Track exactly which instruction files each run read, with their content
  hashes, and report which recorded results a later edit has invalidated.
- Run a case repeatedly as a group, and report paired comparisons between two
  instruction versions with a baseline arm, so verbosity cannot be mistaken for
  improvement.
- Record what every run cost in dollars and how long it took, and refuse to
  start without a spend limit.
- Calibrate a judge against a human's own review of the same evidence, and
  accumulate how often the judge and the human agree.

Every run and every attempt is written to disk as a durable record. Runs take
minutes, cost real money, and can be interrupted partway.

## What is planned

- Running the same case against a matrix of instruction version, model, and
  reasoning effort.
- Showing projected cost before a large run, rather than reporting it after.
- Testing a corpus against a newly released model, removing instructions one
  block at a time to find which ones no longer earn their place, and surfacing
  both the removable instructions and the stages that got worse.
- Editing the instructions under test from inside the tool, with a review step
  before a change is applied.

## What to design

The interface for all of that. Decide what the screens are, what belongs on
each, and how someone moves between them.

Constraints: it is a dense professional tool for a single expert user reading a
lot of structured detail, not a consumer product. Dark mode primary. No meaning
carried by color alone. Real semantic structure and visible keyboard focus
throughout. Include the empty state for whatever you design, because a fresh
install has no data at all.
