---
id: doc-49
title: 'reflection: ACT-113'
type: other
created_date: '2026-09-09 00:00'
---

# Reflection: ACT-113

hashDirectory followed symlinks, so a planted link exposed a file outside the
corpus layout. The card is Done, seven of seven criteria checked, four fix
commits plus a closing commit.

## 1. What is the target condition?

ACT-113 carries no milestone. It is a defect card, filed out of ACT-50's
post-review security axis, and it sits in the board goal only indirectly: the
goal (doc-6/doc-7, unchanged through doc-48) is prove the loop once (m-1),
then the UI three (m-5, m-6, m-7), then m-2, then m-3. ACT-113's place in that
is the trustworthiness of what the UI shows, since the corpus screen ACT-50
built was the screen the leak surfaced through.

The bet is doc-48's queue line 9, which groups ACT-113 with four other cards as
"Medium, independent of each other and the rest". That is a scheduling slot, not
an expectation about what the card would make observable. The card's own
implementation notes record the bet as "picked first from the ready queue by
iterate", pointing at that same line.

So the bet says only: this is small, independent, and worth its slot. What it
was expected to make observable is what the card's own goal states, that
hashDirectory refuses a symlink found inside a walked tree so no file outside
that tree is read, hashed, or reported.

## 2. What is the actual condition now?

Observed directly this session, not read off the card:

- A directory holding `evil -> /tmp/.../outside` is refused, with
  `SymlinkedEntryError: walked/evil is a symlink, which would hash bytes from
  outside the walked tree`. Refused under both `rootMayBeALink: true` and
  `false`, so the root exemption does not reopen the entry position.
- A walked root that is itself a symlink is refused when the caller says
  `rootMayBeALink: false`, naming the prefix (`backlog is a symlink, ...`).
  That is the second half two review rounds added, and it is the half that
  closes criterion #6.
- The live corpus still hashes. `corpusReport` against `~/.claude` returns 123
  files, the same number the card recorded at HEAD, with all four layout roots
  themselves symlinks into `~/.agents`. `find -L` across those four trees finds
  no symlink inside them.
- The suite is green: 1293 pass / 0 fail, plus 100 pass / 0 fail on the client
  suite. ACT-131's flaky peer-ordering test did not fire this run.

Where the bet and the observation differ: the bet said small and independent.
The card was neither. It took a shaping, an adversarial review that reopened the
approach, a build, and a six-axis code review that found two blocking defects in
the first implementation, one of which was the original leak surviving one
directory up. It also spawned five follow-up cards, all still open. The card was
worth its slot, but "small" was wrong, and the reason it was wrong is that the
first shaping settled on a mechanism without asking what each of four callers
does with a thrown error.

One thing the card claims that I could not check the same way: criterion #4, the
vanished-entry tolerance, has no suite test. The card says so plainly and rests
it on one direct observation. I did not re-run that observation. It stands as
the card's own single-run evidence, not as something this reflection confirms.

## 3. What obstacles stand between here and the goal, and which one is next?

The card's own run met three, all recorded:

- A first shaping that picked a mechanism before asking the callers. The
  adversarial review caught it and the approach changed.
- A first implementation whose root exemption was positional rather than
  scoped to the caller that needed it, so the leak survived at the root. Three
  reviewers found it independently and the session reproduced it before fixing.
- A helper that read every error as absence, silently dropping files under a
  readable but unsearchable directory. Four axes found it.

What the handoff says became possible: nothing new is behind a flag. Every
caller of hashDirectory now states its own answer. The residue is not capability
but inconsistency, and it is what the five open cards hold.

The next obstacle is the one that is still a live leak. ACT-132 reproduced here:
a corpus root whose `CLAUDE.md` is a symlink to an outside file returns that
file's bytes hashed under the path `CLAUDE.md`. I planted
`/tmp/act113corpus/CLAUDE.md -> outside_secret.txt` and the report came back
with sha `b37e50cedcd3...`, byte-identical to the outside file's own sha. The
directory walk is fixed; the single-file path beside it is not. Every other
open card from this run is consistency or degradation work. This one is the same
class of defect ACT-113 was filed to close, still open.

## 4. What is the next step, and what do you expect from it?

ACT-132, already on the board, unmodified. It should produce: a corpus root
whose instruction file is a symlink is refused by the same named error the walk
gives, and the outside file's bytes and sha do not appear in the report or the
digest, checked by the same planted-link probe that reproduces it today.

It is the right next step over ACT-129 (three error types, one rule) and ACT-130
(one symlink blanks the run-history screen) because those two are shape and
degradation questions, while ACT-132 is an open path to bytes outside the
corpus. Consistency work done before the last leak is closed has to be redone
when the fix lands.

Not proposing this as a new card. It exists, it is scoped, and its acceptance
criteria are already three items.

## 5. When can the increment be seen?

It is there now, from outside this session, two ways:

- `mise exec -- bun -e` against `hashDirectory` with a planted link, entry
  position or root position, returns `SymlinkedEntryError` naming the entry by
  its corpus-relative path. Run this session.
- The corpus screen against the live `~/.claude` still lists 123 files, so the
  refusal did not cost the real install its lineage. Run this session, and the
  same number the card recorded.

What cannot yet be seen: the corpus screen's behavior when a link is planted. It
returns a 500, by decision, and one symlink blanks the run-history screen
entirely. That is ACT-130's observation to produce, not this card's.

## Verdict

On track.

The bet held on substance: the leak the card named is closed at both positions I
probed, the live corpus is unchanged at 123 files, and the suite is green. It
cost more than its slot implied and it exposed five further defects, but
exposing them is the run working, not the run failing. Nothing here says the
goal should change, and the next step continues it.

## Proposals

Reflect moves no card. These are for triage, with the whole board in view.

- Order the five cards this run filed as: ACT-132 first, then ACT-130, then
  ACT-129, then ACT-128, then ACT-131. Reason: ACT-132 is the only one that is
  still an open path to outside bytes, reproduced this session. ACT-129's
  unification of three error types should follow the last caller landing, not
  precede it, or it gets redone.
- Add no card. The residue of this run is fully held by the five that exist,
  and I found no gap they leave.
- Close nothing. Nothing on the open board was overtaken by this work.

## Process defect, for kaizen

The bet for this card was a scheduling slot, not an expectation. Queue line 9 of
doc-48 groups five cards as "Medium, independent of each other and the rest",
which says when to pick the card and nothing about what it should make
observable. Question 1 of this reflection had to be answered from the card's own
goal instead. Reflection can absorb that, but a bet that carries no expectation
cannot be wrong, and a bet that cannot be wrong teaches the board nothing. The
moment is doc-48's queue construction.

A second instance of the pattern doc-43 already flagged, unactioned across six
triage runs now: this card's first shaping asserted that seedFixture already
refuses symlinked fixtures "so refusing here cannot reject a fixture the harness
would otherwise have accepted", which the adversarial review disproved by
reading the call order. The claim was checkable in the session that made it and
was not checked.

## Structural opportunity

One line, since the refactoring pass ran inside build: three walks now refuse
symlinks with three error types and three messages, and session-run-command.ts
carries two catch blocks for two of them. Already ACT-129.
