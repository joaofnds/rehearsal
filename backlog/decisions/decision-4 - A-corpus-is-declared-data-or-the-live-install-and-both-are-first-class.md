---
id: decision-4
title: A corpus is declared data or the live install, and both are first-class
date: '2026-09-05 01:05'
status: accepted
---
## Context

The harness reads its corpus from the machine it runs on. It enumerates the
live install, hashes what it finds, and copies it into the worktree. Every
recorded run so far measured whatever that one laptop held at that moment.

João named the cost on ACT-28, comment #5: he wanted runs to happen locally so
nobody would deal with per-machine setup, dotfile links, and individual
configuration differences, and the same complexity keeps returning. He added
that other providers will make it worse.

Four defects found on 2026-09-05 share a cause. Hooks and settings are not
frozen (ACT-37). The build stage records no corpus files, so an edit to what it
read invalidates nothing (ACT-74). Staleness reports a file as changed when it
is byte-identical (ACT-73). A replay refuses a corpus source outright, on a
version-stale belief about skill shadowing (ACT-28's own re-probe). Each one is
the harness reasoning about a home directory it does not control.

None of the four needs a concurrent edit to appear. They reproduce on an idle
machine. The separate risk of a mid-run edit silently changing a rep is real
but rare, and João expects it to be an artifact of building the tool rather
than a condition of using it.

Against that, João uses the live corpus as his working loop. He edits his
instructions, reruns a benchmark, and reads whether the change moved the
output. He described his current setup as a live benchmark test. That is the
tool's original purpose and it is not a fallback.

## Decision

A corpus has two sources and the harness treats both as first-class.

A declared corpus is data the case ships and versions with itself. Nothing is
read from any home directory. A run is reproducible on another machine and
another provider needs a delivery adapter rather than a redesign.

A live corpus is the install on the running machine, enumerated and hashed as
it is today. It stays a supported source because iterating on live
instructions is a workflow, not an escape hatch.

The source is named in the run's record, so a reader can tell which kind
produced a score without inferring it.

Build the declared path first. It is what makes a corpus comparable across
machines, and the live path already works well enough to keep using while it
lands.

## Consequences

The harness stops depending on the shape of one machine's dotfiles for its
core behavior, and gains a boundary where a home directory is parsed once into
a corpus it controls. The four defects above become one question with one
answer instead of four independent fixes.

A case that ships its corpus can be run by a colleague and produce a comparable
number. A case that uses the live corpus cannot, and that is correct, because
the thing it measures is one machine's setup.

Cost: two sources to keep working, and every corpus-shaped feature answers for
both. The alternative, declared only, was rejected because it removes the loop
João uses daily. The alternative, live only, was rejected because it is what
produced the four defects.

Comparability across sources is not claimed. A declared-corpus run and a
live-corpus run are not two arms of one comparison.
