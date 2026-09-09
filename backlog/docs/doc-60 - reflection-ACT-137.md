---
id: doc-60
title: 'reflection: ACT-137'
type: other
created_date: '2026-09-09 16:06'
---


# Reflection: ACT-137

Card: ACT-137, GET /api/corpus reports a confident digest over a symlinked
CLAUDE.md when the source is the live corpus. Status Done. Four commits named in
the card, plus five more the review rounds produced.

## 1. What is the target condition?

ACT-137 carries no milestone, and that is deliberate rather than an omission.
doc-56 puts the four High cards outside every milestone, on the reasoning that
three of them are defects that would corrupt or leak and so precede milestone
work rather than belonging to it. The board's goal (doc-6/doc-7) is prove the
loop once (m-1), then the UI three (m-5, m-6, m-7), then m-2, then m-3.

The bet, from doc-56's queue line: "the symlinked instruction file, and the card
that records the containment predicate ACT-134 inherits." Two expectations, then.
That the corpus screen stops serving a confident digest over bytes the corpus
does not hold, and that this card would settle the predicate its neighbour builds
on.

## 2. What is the actual condition now?

Probed this session, from the repository root, not read off the card:

    LIVE          files=122  digest=723012  refusals=[]
    DIR-HOSTILE   digest=undefined  files=1
                  refusals=["Corpus file CLAUDE.md resolves outside the corpus
                  source, which would hash bytes the corpus does not hold"]
    LIVE-HOSTILE  digest=f7fa46  refusals=[]
                  files=[CLAUDE.md, skills/build/SKILL.md]

The full suite is green: 1353 server tests across 85 files, 105 client tests
across 18 files, zero failures.

Half the bet held, and the card says so itself rather than being caught at it.
The directory route now returns the shape ACT-135 shipped for layout
directories, a named refusal with the digest withheld. The five acceptance
criteria the card closed on are the ones it could close, and the build session
moved AC#1 to ACT-141 with the original text quoted so it could be corrected.

The live route still hashes the outside file under a confident digest with zero
refusals. That is the LIVE-HOSTILE line above, and it is the defect as the card
originally stated it. So the card's title still describes today's behavior on
the route the operator's server actually wires (serve.ts:53), while the card is
Done. The split is honest and documented, but a reader scanning titles would
draw the wrong conclusion.

The second half of the bet did not hold, and this is the more useful finding.
The card was expected to record the containment predicate ACT-134 inherits.
Doc-58's shaping established that no predicate derived from the corpus root's
own contents survives: an anchor at the layout entry is vacuous at the top
level, capturing trusted trees resolves through the hostile link, and nothing
intrinsic separates a benign top-level link from a hostile one. So ACT-134
inherits the finding that no derived predicate works, plus a decision taken by
the overseeing session rather than by the operator. ACT-141's notes state this
plainly: "ACT-134 inherits no predicate, because there is not one."

Two things I found that the card does not carry.

The live digest has moved. The card, ACT-141 AC#2, and doc-56 all pin
c7000b. It reads 723012 today at the same 122 files and zero refusals. The
dotfiles repository has three commits since ACT-137's build, so the corpus
itself changed and the file count held. ACT-141 AC#2 therefore pins a digest
that is already stale and would fail on a literal reading the day someone
builds it.

ACT-136's picker defect was fixed outside this repository. Dotfiles commit
c7b9e843, "fix: match every tag on a queue line, and refuse a silent
reflection", addresses exactly what doc-56 described: the tag portion matched at
most one bracketed tag, so a `[HIGH] [bug]` line could not match and the picker
fell through to a lower card. doc-56 built its whole queue around that defect
standing.

## 3. What obstacles stand between here and the goal, and which one is next?

The run met one real obstacle and it was correctly refused rather than routed
around. The live half needs an extent declared from outside the corpus root, and
that is a question about what the product is, not about how to write the code.
The shaping session raised it as blocking; the overseeing session answered it
under the unattended rule and recorded the reasoning against decision-4. The
build then shipped the half that did not depend on the answer. That sequence is
the run working as intended.

What the run found beyond its own scope is the sharper obstacle. Two more 500s
on the same screen, both reproduced at the source and both filed rather than
absorbed: ACT-142 (GET /api/runs, through staleness-report.ts calling
readCorpusInstructions outside any try) and ACT-150 (an unreadable or looping
file inside a layout directory, through checkpoint.ts's walk). Add ACT-141 and
the corpus screen has four open cards against it. The card's own structural
finding names why: how a corpus entry fails to be hashable is now knowledge in
two places, the walk classifying two states and the instruction file five, with
the walk's two a subset.

The next obstacle is that the decision this whole cluster rests on was taken by
a session and not by the operator. ACT-141 and ACT-134 both build on the
declared extent. The overseeing session's reasoning is sound and I would not
reverse it, but it is one session's reading of decision-4 against another's, and
the two cards that depend on it are the board's remaining High work.

## 4. What is the next step, and what do you expect from it?

ACT-141, which exists and needs no creation. It is the extent-dependent half,
already carrying the decision, the consumer count from doc-58, and the warning
that calibration.ts:459 calls resolveCorpusFile synchronously.

The observation it should produce: the LIVE-HOSTILE line above returns a refusal
naming CLAUDE.md and no digest, while the live install still reports 122 files
with zero refusals.

ACT-134 stays behind it, unchanged.

## 5. When can the increment be seen?

For what ACT-137 shipped, it can be seen now. Point a directory source at a root
whose CLAUDE.md symlinks outside it and open the corpus screen: it renders the
refusal naming CLAUDE.md rather than "Could not load the corpus." I confirmed
the report half this session by calling corpusReport directly. The build session
confirmed the HTTP and rendered halves and was explicit that no browser engine
ever painted it, because none is installed on this machine.

For the live half, it cannot be seen, and that is what ACT-141 is for.

## Verdict

**On track.**

The bet held on the half that was buildable, the half that was not was split out
with its original text quoted rather than quietly dropped, and the run's review
rounds found five real defects in the neighbourhood and closed them. The two
that landed in files this card never touched were filed rather than absorbed.
The evidence for on-track rather than adjust: the goal is unchanged, the next
step is a card that already exists in the right order behind this one, and the
run's own record is accurate everywhere I checked it against a probe.

Not pivot. Nothing here is evidence about the goal. The extent question is about
what the product should do, and it was answered on the record rather than left
open.

## Proposals

For triage to apply. Reflect moves no card.

1. **Correct ACT-141 AC#2's digest.** It pins c7000b; the live report reads
   723012 today at the same 122 files and zero refusals, because the corpus
   itself changed. Recommend the criterion assert the file count and zero
   refusals, and that it name the digest as a value to re-measure at build time
   rather than a constant. A criterion that pins a digest over a corpus under
   active edit fails on a true system. This is the same defect class doc-56
   named as recurring: a card carrying a fact true when written and false later
   without anyone touching it.

2. **Re-examine ACT-136 before scheduling it.** Dotfiles commit c7b9e843 fixes
   what doc-56 described as its defect. I read the commit message and its stat,
   and did not verify the picker's behavior against the live listing, so this is
   inference from the commit and not a verified close. Triage should run the
   picker once and close the card if it now returns the board's first line.
   doc-56's queue reasoning assumed this defect stood.

3. **Consider grouping the corpus screen's four open cards.** ACT-141, ACT-134,
   ACT-142 and ACT-150 are all one screen failing on one class of unhashable
   entry. The card's own structural finding says the classification now lives in
   two places with one a subset of the other. Recommend triage weigh whether one
   card unifying the classifier precedes the four, rather than four independent
   fixes each teaching the walk one more state. Not a merge; the cards are on
   different code paths, which is what decision-9 settled.

4. **Note for whoever picks ACT-141: the extent decision is a session's, not the
   operator's.** It is recorded on ACT-137 with the reasoning. It is worth one
   line of confirmation before two High cards are built on it.

Process defect, for kaizen: a card whose title states a defect that still
reproduces can reach Done when its criteria are split. ACT-137's title describes
LIVE-HOSTILE behavior that is unchanged today. The record is honest throughout
and the split is documented, so this is not a false close. But the board's
titles are what a scan reads, and a reader would conclude the live route is
fixed. The moment: the build session removing AC#1 to ACT-141 without amending
the title to name the half it actually shipped.

Structural opportunity, one line, already on the card for ACT-150: the walk
classifies two failure states and the instruction file five, the walk's two
being a subset, and a third copy should not be added.
