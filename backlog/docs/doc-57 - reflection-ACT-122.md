---
id: doc-57
title: 'reflection: ACT-122'
type: other
created_date: '2026-09-09 14:10'
---

# Reflection: ACT-122

Card: ACT-122, redactAbsolutePaths misses the quoted path shape Node's fs errors
use. Done, 7 of 7 criteria checked. Bet: doc-56, "The bet on ACT-122". Milestone:
none. The card is one of the four High defects doc-56 places outside every
milestone, ahead of milestone work because it leaks.

The card carries every part of the record: shaped section, two rounds of
adversarial review with their overturned picks, the build note, the six-axis
review, and the handoff. Six commits, 95acb4c through 04de356. Nothing missing.

## 1. What is the target condition?

The board's goal (doc-6/doc-7) is prove the loop once, then the UI three, then
m-2, then m-3. This card belongs to none of them. It sits in the group doc-56
calls the four High defects outside every milestone, whose target condition is
that the shipped surfaces do not corrupt or leak while the milestone work
proceeds.

The bet, from doc-56: an error the server forwards to a browser no longer carries
the operator's home directory, on the message shape Node's filesystem errors
actually use. Observation named: pass
`ENOENT: no such file or directory, open '/Users/<user>/code/rehearsal/x.md'`
through `redactAbsolutePaths` and get the path replaced with the message
otherwise intact, while `agents/escape.md added` still passes untouched. Budget:
no provider spend, one build session. Named falsifier: if widening the lookbehind
also eats relative paths or record ids, the regex is the wrong mechanism.

## 2. What is the actual condition now?

The bet held. Run this session against the module on main, not read off the card:

    "ENOENT: no such file or directory, open '$HOME/code/rehearsal/x.md'"
      -> "ENOENT: no such file or directory, open '<path>'"
    "agents/escape.md added"        -> unchanged
    "checkpoint:2026/shape"         -> unchanged
    "skills/build/SKILL.md"         -> unchanged
    "failed at /srv/target-repo/x.md" -> "failed at <path>"
    "ENOENT: ..., rename '/srv/a' -> '/srv/b'" -> both paths replaced

Full suite this session: 1346 server pass / 0 fail, 105 client pass / 0 fail.
Tree clean at HEAD 04de356.

Where the observation went past the bet. The falsifier fired, and the card
absorbed it instead of stopping. Two rounds of adversarial review each overturned
the pick, and the mechanism that shipped is not the one the bet assumed. The bet
said "the fix is one lookbehind". It is not: a purely syntactic pattern guesses
where a path ends from a delimiter, and every delimiter it could trust occurs
inside real directory names, demonstrated on a directory named `Bob's Projects`.
What shipped anchors on `homedir()` and `tmpdir()` first and keeps the syntactic
rules only as a net behind them. That is the falsifier's own prescription, the
redactor knowing what a path is rather than what precedes one, taken as far as it
goes without the caller naming a root.

Two defects the card found that the bet did not name, both fixed and both
verified in the record: a degenerate root (`TMPDIR=/`, or `homedir()` of `/` for
root in a container) destroyed every relative path, and five leak assertions in
`api.test.ts` re-implemented the buggy pattern, so they agreed with the redactor
exactly where it was wrong.

The limit that remains, stated on the module rather than hidden: a path
containing a quote character leaves the fragment after that quote behind. The
root is gone; a directory and file name with no location survive. Closing it
needs the message's producer to mark its paths.

## 3. What obstacles stand between here and the goal?

Met by this run, and all cleared: the mechanism the bet assumed was wrong, caught
by review rather than by the build; two criteria were unsatisfiable or vacuous as
written and were rewritten against what the code can actually do (AC#6 rewritten,
AC#7 added).

Standing, and the reason this card was slow to reach: iterate's picker cannot
match a two-tag line, so it skipped ACT-122, the board's own first line, and
returned ACT-136. Confirmed this session at the source, `~/.scripts/iterate`
line 32: `queuePattern` admits one optional bracketed group. Every card that is
both High and a bug is invisible to the loop. ACT-137 and ACT-139 are the next
High cards and ACT-137's line carries one tag, so the loop moves, but the defect
still hides an unknown share of the queue and no session in this repository may
fix it under the hard line on files outside the directive's repository.

What the handoff says became possible and is not wired: `redactorFor(roots)` is
exported, so a caller can build a redactor against roots it names. Only tests use
it; all nine production sites still call `redactAbsolutePaths`.

The next obstacle is not this card's. It is containment: ACT-137 and then
ACT-134, where a symlinked instruction file and a symlinked layout directory make
the live-corpus route serve bytes from outside the tree as ordinary corpus data.
doc-56 verified both reproduce. That is a read of foreign bytes, which outranks a
leak of a path string.

## 4. What is the next step, and what do you expect from it?

ACT-137, "GET /api/corpus reports a confident digest over a symlinked CLAUDE.md
when the source is the live corpus". It exists, is High, is unblocked, and is
next in doc-56's queue.

Expected observation: the live-corpus source refuses a symlinked root instruction
file the same way the directory source already does, so the two sources agree,
while the two of three layout directories that are legitimately symlinks
(`agents`, `rulebook`) and the symlinked root instruction file in this operator's
own corpus do not empty the report. ACT-137 records the containment predicate
ACT-134 then inherits.

## 5. When can the increment be seen?

ACT-122's increment is there now, from outside this session. Start the server and
force a 500 from a real ENOENT under `$HOME`: the body reads
`{"error":"ENOENT: no such file or directory, open '<path>'"}`, no home
directory. The card's build and review notes record that runtime observation, and
the module-level probe above reproduces it without a server.

ACT-137's increment will be visible on the corpus screen: a symlinked
`CLAUDE.md` shows as a refusal rather than as a confident digest. Not there now,
verified by doc-56's reproduction.

## Verdict

On track. The bet's observation was produced and holds under a direct probe this
session; the mechanism changed under review, which is a card stumbling on its
approach and not evidence against the goal. The next step continues the same
group of shipped-surface defects.

## Proposals

For triage, which moves the cards.

- Take ACT-137 next, then ACT-134 behind its dependency. No change to doc-56's
  queue; this reflection found nothing that reorders it.
- Add a card: route the nine production call sites through `redactorFor` with the
  roots each caller knows. Observation it targets: an error naming a path under a
  checkpoint's corpus root or the target repository, neither of which is
  `homedir()` or `tmpdir()`, comes back with that root replaced and no relative
  fragment left behind. This is the reopening condition the module documents, it
  closes the quote-fragment limit, and the export exists unused. Low: the
  fragment that leaks has no location attached to it.
- No card to close, split, or reorder.

Process defect, for kaizen: two rounds of adversarial review each overturned the
pick, and both overturns came from probing a real thrown fs error rather than a
hand-written string. The first round's survey concluded "the choice is not
load-bearing" from probes run only against this repository's own message shapes,
with the scope limit unstated. The moment is the option survey that draws a
verdict from probes whose scope it does not name.

Second process defect, already carded as ACT-136 and unbuildable here: the board's
first line was skipped by the loop's picker for a full cycle because its line
carried two tags. The card was reached manually.

Structural opportunity: `usableRoots` drops a root shorter than a directory under
`/`. That is a guard against a degenerate environment expressed as a length test
inside the redactor. If more callers name roots, it wants to become a validated
root type at the boundary rather than a filter at the point of use.
