---
id: doc-51
title: 'reflection: ACT-132'
type: other
created_date: '2026-09-08 23:54'
---


# Reflection, ACT-132

The card is Done with all 21 criteria checked, a handoff, a review record, and
seven commits it names. Nothing is missing from the record.

## 1. What is the target condition?

ACT-132 carries no milestone field. Its goal comes from the board's standing
order in doc-6/doc-7, restated in doc-50: prove the loop once (m-1), then the UI
three, then m-2, then m-3. The card serves that goal indirectly, as a defect on
work already shipped: a benchmark result is only a measurement of the corpus it
names, so a corpus source that can hand over bytes from outside its own root
makes every recorded result unfalsifiable.

The bet is doc-50's queue line 1: "ACT-132 (High): the last open path to outside
bytes, reproduced 2026-09-09. doc-49's named next step." What it expected to make
observable is that a declared corpus source cannot hand the harness bytes from
outside its own root through a symlink, on every surface a case author reaches,
while the live install keeps reporting through its own symlinked layout.

The bet's phrase "the last open path" is the part that did not hold. It said last;
the run found more paths than it started with and one it cannot close.

## 2. What is the actual condition now?

Observed by me at HEAD (2653319), running the functions directly against a
fixture I planted this session at /tmp/act132r: a directory corpus root whose
CLAUDE.md links to an outside file and whose skills/linked is a link to an
outside directory.

- readCorpusInstructions: SymlinkedEntryError, "Corpus file CLAUDE.md resolves
  outside the corpus source, which would hash bytes the corpus does not hold".
- hashCorpusFiles on CLAUDE.md: same type, same shape.
- hashCorpusFiles on skills/linked/secret.md, the intermediate-directory case:
  refused, naming the layout path.
- corpusReport: refused, same type.

No message carried the target's absolute path or its bytes. One error type across
all four, which is what criterion #15 asked for.

The live corpus still reports: corpusReport(liveCorpusSource()) returned 122
files with a CLAUDE.md entry, digest 71f97a. The count is 122, not the 123
criteria #7 and #19 record. The handoff already says so and says it measured 122
at the baseline 2191223 too, so the number tracks this machine's ~/.agents tree
rather than any code change. I did not re-measure the baseline.

Full check at HEAD, run by me: bun run test 1310 pass 0 fail plus 100 client pass
0 fail.

Where the bet and the observation differ, in three places:

- The leak was one site on the card and four in the code. corpus-report's
  instruction hash was the only one named; readCorpusInstructions,
  hashCorpusFiles, session run --corpus (8617b76) and
  installStageCorpusSnapshot (1921434) were each found and each reproduced
  before being closed. The install site is the one that matters most: replay
  --corpus was writing outside bytes into the worktree a stage session reads
  while the read surfaces refused them, so the harness disagreed with itself
  about what the corpus was.
- The mechanism the shaping picked (lstat the leaf) would have shipped broken.
  Review round 1 caught it before any code was written, and the fix that shipped
  is containment of the fully resolved path, one predicate shared by four
  modules.
- The bet's "last open path" is false. A hardlinked corpus file still hands over
  outside bytes. I reproduced it at HEAD: a root whose CLAUDE.md is `ln` (not
  `ln -s`) to /tmp/act132h/outside/h.md, and hashCorpusFiles returned sha256
  676f9d60...94, equal to shasum of the outside file, unrefused. This is filed as
  ACT-133 and is not a defect in this change: no path-based guard can see a
  hardlink, because it resolves to a path inside the root.

## 3. What obstacles stand between here and the goal, and which one is next?

What the run met:

- The card's own stated cause was one quarter of the actual cause. Three of the
  four leaking sites were found by looking, not by reading the card. Two of those
  three (session run --corpus, installStageCorpusSnapshot) were sites the shaping
  had positively recorded as already guarded.
- Two surfaces disagreed on a link pointing back inside the root, under one error
  type, so a corpus could pass stale --corpus and be refused by the corpus screen.
  Closed in c9ffe4d by making the walk judge an entry by where it resolves too.
- A review probe's debug lines were committed by mistake in 8617b76, refusing
  every live-source hash. Removed in c3ca1bd. I confirmed the removal is at HEAD
  and the tip is correct. Published history was not rewritten, so that one
  commit's tree stays wrong.
- A limit the mechanism cannot pass: hardlinks. ACT-133.

What became possible: resolvesOutside is exported from corpus-file.ts and used by
session-corpus.ts and checkpoint.ts. Nothing outside those three needs it today.

The next obstacle is ACT-130, unchanged from doc-49's order and doc-50's queue
line 2. This card made the refusal correct and uniform on the read surfaces; it
did not make the screen survive one. corpusReport now throws SymlinkedEntryError
where /api/corpus catches nothing, so a single planted link still returns a 500
for the whole run-history screen. ACT-132's shaping named this explicitly as out
of scope and ACT-130's scope, and that call was right: it kept the change
reviewable alone. But it means the user-visible consequence of this work is
currently an outage rather than a message.

## 4. What is the next step, and what do you expect from it?

ACT-130, existing, High, m-5: "One symlink in the corpus blanks the whole
run-history screen instead of degrading."

The observation it should produce: with the /tmp/act132r fixture above declared
as a corpus source, the run-history screen renders, and the corpus that cannot be
read is named as refused rather than returning a 500 for the page. That is the
same fixture this reflection used, so the check is already built.

Expected: it is a catch-and-degrade at one route, not a change to the guard. The
guard is settled and I would not reopen it.

ACT-133 is not the next step. Its own card says the first question is whether the
hardlink is worth closing at all, the threat is a case author rather than a remote
attacker, and refusing every multiply-linked file would refuse a corpus that
legitimately hardlinks within itself. It should sit until something asks for it.

## 5. When can the increment be seen?

From outside the session, at HEAD today:

- The refusal: plant a symlinked CLAUDE.md in a directory corpus and run
  `stale --corpus <root>`. Run by me at HEAD against /tmp/act132r/corpus: exit
  code 3, stdout empty, stderr carrying "Corpus file CLAUDE.md resolves outside
  the corpus source, which would hash bytes the corpus does not hold". There now.
  I did not run `replay --corpus`, which the card's criterion #16 covers under
  the same translation.
- The live install still working: `corpusReport(liveCorpusSource())` returns 122
  files with CLAUDE.md. There now.
- The screen degrading: not there. That is ACT-130.

## Verdict

Adjust.

The goal stands. The bet held on its subject and was wrong on its scope: the leak
was four sites rather than one, two of them at places the card recorded as
already guarded, and "the last open path" was falsified by the hardlink the same
session found. The plan changes only in what the board now believes about this
surface, which the proposals below carry.

This is adjust and not pivot because none of the evidence is about the goal. A
corpus that cannot say what bytes it holds still makes every measurement
unfalsifiable, which is why the card was High.

## Proposals

For triage, which moves the cards.

- Correct the file count on ACT-132's criteria #7 and #19 from 123 to 122, with
  the note that the number is a baseline for this machine's ~/.agents tree and
  not a constant. Measured 122 at HEAD this run and, per the handoff, at the
  baseline commit too. The card is Done and this is a record correction, not a
  reopening.
- Keep ACT-130 at queue position 1, unchanged. It is now the only thing standing
  between this work and a user seeing it.
- Leave ACT-133 unprioritized and below ACT-129. Its first question is whether to
  close it at all, and nothing on the board waits on the answer.
- Re-read ACT-129's premise before it is picked up. Its three error types are
  still three, verified this run by reading session-attempt.ts:234,
  session-corpus.ts:149 and checkpoint.ts:90. But two of the three messages were
  rewritten by this card, from "is a symlink" to "resolves outside", so the card's
  quoted messages are stale even though its count is right.
- No card to close, no split, no reorder.

## Process defect, for kaizen

The shaping recorded two sites as already guarded that were not, and both were
leaking. The shape stage wrote "session-run reaches hashCorpusFiles on a snapshot
whose directory branch session-corpus.ts refuseSymlinks already lstat-checks, so
that path is guarded today", from reading the code rather than probing it. The
build stage probed it and found the leak. This is ACT-127's pattern, an eighth
instance: a card's record states a fact that inspection contradicts. What makes
this one worth adding is that the false claim was a negative, "this path is
guarded", and the corpus's own Claims rule already names an unprobed negative as
the thing to check. The guard did exist; it just did not cover the case. Reading
a guard's existence and claiming its coverage are two different claims and the
record made them one.

## Structural opportunity

One line: resolvesOutside is now the single containment rule and lstat survives
in checkpoint.ts for exactly the two cases resolution cannot answer, an entry
that vanished mid-walk and a dangling link. That is a clean seam and it needs
nothing.
