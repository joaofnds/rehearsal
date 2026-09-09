---
id: doc-55
title: reflection-ACT-135
type: other
created_date: '2026-09-09 12:45'
---

# Reflection: ACT-135

The card carries no milestone field. The goal it was picked against is doc-54's,
unchanged from doc-6 and doc-7: prove the loop once (m-1), then the UI three
(m-5, m-6, m-7), then m-2, then m-3. ACT-135 sits outside that ordering. It was
filed by triage as the board's only High and queued first because the failure it
names recurs from a shipped process and is invisible to every check the project
runs. So its target condition is the goal's precondition rather than one of its
increments: the corpus screen, which m-5 shipped and m-7 builds on, must not go
dark and silent when the live corpus holds a file the harness cannot hash.

## 1. What is the target condition?

The bet, doc-54's queue line and the card's own note: make the corpus screen name
an unhashable live-corpus entry and keep showing the rest, so the next stray
symlink is reported within one screen load rather than sitting unnoticed for eight
hours. The prevention half, a hook denying agent writes under ~/.claude and
~/.agents, was declared out of reach at shaping and queued for a typed
instruction, so the card's observable claim is detection alone.

## 2. What is the actual condition now?

The bet held on the route it claimed, and I checked it myself rather than reading
the card.

Against a temp corpus root holding CLAUDE.md, skills/build/SKILL.md,
agents/normal.md, agents/escape.md pointing outside the root, and a dangling
agents/aardvark.md, corpusReport under a live source resolved. It returned
CLAUDE.md and skills/build/SKILL.md, digest undefined, and both refusals:
'agents/aardvark.md is a link whose target is missing, so the bytes it names
cannot be read' and 'agents/escape.md resolves outside the tree it is named
under, so its bytes are not the ones that tree holds'. The digest is a required
key on CorpusReport holding string | undefined, which Response.json drops from
the wire, so the screen has no digest to label. Neither refusal carries an
absolute path,
and the escaping link is named even though a benign link sorts before it. Before
this card that call threw and /api/corpus returned 500 with nothing.

Against the real live corpus, corpusReport(liveCorpusSource()) returns 122 files,
zero refusals, digest present. So the degradation did not cost the healthy path
its digest.

~/.claude/agents holds advisor.md and reviewer.md and nothing else. The stray is
gone and has not returned.

Where the bet and the observation differ: the card's original AC#1 asked for
prevention or detection, and only detection shipped. Nothing stops the next stray
being planted. The card says so plainly and queues the hook.

One criterion was removed rather than delivered. It described a symlinked
CLAUDE.md, which sits outside the layout-directory loop this card changed, and it
is now ACT-137 (High, To Do). On that route the live source still returns a
confident digest over bytes the corpus does not hold, which is the exact defect
class this card's own shape review rejected as B1, surviving one route over.

## 3. What obstacles stand between here and the goal, and which one is next?

Four, in the order they cost.

The corpus screen still has two routes on which it reports confidently rather
than refusing, and I found the second myself while checking the first.

ACT-137 holds the instruction file. On a root whose CLAUDE.md is a symlink out of
the tree, a live source returns a digest over bytes the corpus does not hold and
no refusal. Its criteria already forbid closing it by making the live route throw,
which would restore the 500 this card removed.

ACT-134 holds the layout directory, and its cost on this screen is larger than
its card records. I probed a root whose agents/ is itself a symlink to an outside
directory holding leak.md: corpusReport under a live source returned CLAUDE.md,
skills/build/SKILL.md and agents/leak.md, digest 8257a6, zero refusals. So a file
from outside the corpus is served as an ordinary corpus file, under a confident
digest. The card's own review anticipated this as N12 and understated it: it
predicted the containment violation would become a line of text on the screen,
and it becomes silently included data instead. ACT-134's AC#1 is scoped to
captureStageCorpus and its Medium priority rests on a threat model written before
this route reached a screen.

The prevention half has no owner inside this repository. The enforcement point is
the agent harness's own settings, reserved by a hard line for an instruction typed
into a session. It stays queued on the card as an exact ask and nothing this build
did reduces the need for it.

Probes keep writing outside their sandbox, and the second instance was recorded on
this very card. During its review round, scratch-ck.ts, probe1.test.ts and
costprobe.ts appeared in the repository working tree, and two of the session's own
measurements were invalidated by reading a file a concurrent session was mutating.
That is the same class of leftover ACT-135 was filed about, one directory over,
and the queued hook does not cover the working tree.

The loop that runs these cards is unreliable in two ways found during this card's
run. ACT-136: iterate's picker regex matches at most one bracketed tag, so a
'[HIGH] [bug]' line never matches and the script silently ran ACT-50 while triage's
prose said ACT-135, writing its bet note onto the wrong card. ACT-139: iterate's
Done branch checks only that nothing is uncommitted, so a reflect session that
produced nothing at all was reported as '<card> is Done' and exit 0. That happened
on this card, which is why this reflection is the second attempt at it. Both cards
are High, both live in ~/.scripts/iterate outside this repository, and together
they mean an unattended iteration can pick the wrong card and then record a
reflection that never happened.

The next obstacle is the pair, ACT-137 and ACT-134, taken as one question about
what the live source is allowed to hash. Ranking them against each other on this
evidence would be guessing: both put foreign bytes behind a confident digest on
the same screen, ACT-134's route admits a whole outside tree rather than one file,
and both are held back by the same live exemption at corpus-file.ts:106-112, which
exists because ~/.claude's own layout directories are symlinks into ~/.agents.

## 4. What is the next step, and what do you expect from it?

Shape ACT-137 and ACT-134 together as one containment question before either is
built, then build whichever the shaping says comes first. ACT-137 is High and
already carries five criteria and a reproduction; ACT-134 is Medium and its
criteria do not mention the corpus screen at all.

The observation the work should produce, covering both routes: against a corpus
root whose CLAUDE.md is a symlink resolving outside it, and against a root whose
agents/ is itself a symlink to an outside directory, GET /api/corpus returns 200
carrying a refusal naming the offending path and no digest, and the file from
outside the tree does not appear among the files. Meanwhile
corpusReport(liveCorpusSource()) against the real ~/.claude still returns its 122
files with zero refusals and a digest. Both halves are needed, since ~/.claude's
own layout directories are symlinks into ~/.agents and a fix that refuses linked
roots empties every live report.

## 5. When can the increment be seen?

Run the harness's server and open the corpus screen against a corpus root holding
a planted symlink under a layout directory. It should render the surviving files,
the refusals naming each unhashable entry by layout-relative path, and no
'corpus root@<hash>' label.

What I observed this session is the data behind that screen, by calling
corpusReport directly, not the rendered page. The render is pinned by client
tests and by corpus-page.tsx suppressing the digest label whenever refusals are
present. Nobody in this run opened the page, so the screen itself is the one part
of the increment still taken on the code rather than on sight.

What is not there yet: the same screen against a root whose CLAUDE.md is the
symlink, or whose agents/ is itself a symlink out of the tree. Both still show a
confident digest and no refusal, and the second serves the outside file as corpus
data. That is ACT-137's and ACT-134's increment and it cannot be seen today.

## Verdict

On track. The bet held and was verified independently of the card's record: the
detection ships, the healthy live corpus is unharmed, and the hiding attacks the
review round found are closed. The next step continues the same goal rather than
changing it.

Adjust was weighed and rejected. The card left two routes on which the screen
still reports foreign bytes under a confident digest, and I found the second
myself during this reflection rather than reading it off a card. But both were
fenced off in ACT-135's shaping before the build started, both are carried by
open cards, and neither is evidence against the goal or against the way the card
was built. What they change is which card is next and how ACT-134 is priced,
which the proposals below carry.

## Proposals

Shape ACT-137 and ACT-134 as one piece of work, for triage. Reason: both make
the corpus screen report foreign bytes under a confident digest, both are gated by
the same live exemption at corpus-file.ts:106-112, and ACT-137's own notes already
raise the question. Deciding it inside one shaping is cheaper than running two
builds against one containment rule. No reorder is proposed: ACT-137 is already
High and already sorts above ACT-114 and ACT-50, which are Medium, so doc-54's
queue prose putting ACT-114 second is simply older than ACT-137.

Raise ACT-134 from Medium, or fold it into ACT-137's priority, and add to it the
observation recorded in section 3. Reason: its Medium was set on a threat model
that predates this evidence, its criteria are scoped to captureStageCorpus, and
nothing on the card records that the same input now serves an outside file to the
corpus screen with a digest and no refusal. Probed this session: a root whose
agents/ links to an outside directory yields files including agents/leak.md,
digest 8257a6, zero refusals.

ACT-136 and ACT-139 need no reorder either; both are already High and already
sort above every Medium. What they need is the operator's route to ~/.scripts,
since neither lives in this repository and no session here can commit a fix to
them.

Add a card: a probe that writes outside its own temp root leaves the working tree
dirty and no check names it. Targets the observation that a session running a
mutation probe cannot leave a file under src/ or the repository root without the
next check reporting it by name. Reason: recorded twice now, once as this card's
subject in ~/.claude and once inside this card's own review round in the repository
tree, and the queued PreToolUse hook covers only the first.

Process defect, for kaizen: this card's shape stage left sixteen criteria where it
meant eleven, because backlog's --ac flag appends and the pre-review draft and the
post-review revision were both written with it. Five superseded criteria had to be
pruned by hand before the build, and the pair disagreed in substance, not only in
wording. The moment is a skill using --ac twice on one card without reading back
what the first call left.

Structural opportunity, one line: SymlinkedEntryError is now translated into a
reader-facing outcome at six sites, and the card's refactoring axis recorded that a
seventh makes the move pay, by putting the translation beside the error in
file-presence.ts.
