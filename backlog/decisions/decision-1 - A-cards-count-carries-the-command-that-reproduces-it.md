---
id: decision-1
title: A card's count carries the command that reproduces it
date: '2026-09-03 13:06'
status: accepted
---
## Context

Triage on 2026-09-03 found four cards whose counts had gone stale within days
of being filed:

- ACT-26.7: "17 `console.log` sites in `src/benchmark/`". There were 14.
- ACT-27: "run-command.ts is 236 lines". It was 406.
- ACT-29: "over 1500 leaked directories". There were 210.
- ACT-32: cites `session-attempt.ts:284`. The site had moved to 318.

Each count was correct when written. Each is a card's evidence of size, and
size is what a reader prioritizes by. ACT-27's was wrong by 170 lines in the
direction that understates the work, so a reader trusting it would have ranked
the card too low.

The triage skill already says a premise is checked "by grep, `git log`, or
re-running the measurement". That assumes the card says how the number was
measured. None of these did, so re-running it meant reconstructing the
writer's intent first.

João's framing, on being asked whether to drop counts: keep them, but give the
reader a way to tell what the number meant at the time, the way a price is read
against inflation.

## Decision

A count, a size, or any measured quantity on a card is written with the command
that produces it, and the result is stated as that command's output on a named
date.

    Fourteen harness diagnostics still write to stdout
    (`grep -rn 'console\.log' src/benchmark/ | wc -l` → 14, 2026-09-03).

A line-number citation is not a measurement and does not get a command. It gets
a symbol name instead, which survives the next refactor; the triage skill
already requires this.

Where no single command reproduces the number, the card says how it was
counted, in one sentence, and that sentence is the reproduction instruction.

An acceptance criterion is still written against an observable behavior, never
against a count. This decision governs a card's evidence, not its acceptance.

## Consequences

The inflation analogy holds better than a timestamp would. A date tells a
reader the number is old; a command lets them get today's number and compare,
which is what they actually wanted. It also makes the writer state what they
measured, which is where ACT-26.7's 17-versus-14 discrepancy came from: the
number and the grep behind it had already drifted apart when the card was
written.

Triage re-runs the command rather than reconstructing the measurement, and the
dated note beside the writer's evidence becomes two comparable numbers from one
command instead of two numbers of unknown provenance.

Cost: one command per count, at writing time, when the writer has just run it
anyway.

This decision is about how cards are written, so it belongs in the corpus, not
only on this board. Carrying it into the shape and build skills is ACT-36.
