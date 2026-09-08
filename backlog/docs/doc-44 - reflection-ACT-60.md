---
id: doc-44
title: 'reflection: ACT-60'
type: other
created_date: '2026-09-08 17:13'
---

# Reflection: ACT-60

## 1. What is the target condition?

Board goal (doc-6/doc-7, unchanged): prove the loop once (m-1), then the UI three
(m-5/6/7), then m-2, then m-3. ACT-60 belongs to m-3 ("Tell a real corpus
improvement from noise"), fourth in that sequence and not yet reached in order,
though it was worked and closed regardless.

The bet, from doc-41/doc-43's triage: `~/.agents/rules/` was renamed to
`rulebook/` sometime after 2026-09-04, so ACT-60's premise (and all eight of its
acceptance criteria, drafted against `rules/`) was stale and needed re-scoping
against `rulebook/` before building. Doc-43 (2026-09-08-d) flagged this as the
third item in its priority queue: "re-scope against `rulebook/` before building."

The underlying goal ACT-60 serves: a session-case corpus A/B that changes an
instruction file should be measurable — declared, hashed, checkpoint-staling, and
manifest-visible — the same way agents/, output-styles/, and skills/ already are.
Before this card, rulebook files were invisible to that machinery entirely.

## 2. What is the actual condition now?

Matches the bet, and goes past it. The card was re-scoped to `rulebook/` (not
`rules/`) and built same-day. Verified directly this session:

- `corpus-file.ts` lists `"rulebook"` in `CORPUS_LAYOUT_DIRECTORIES`, and its
  refusal message names `rulebook/<name>.md` as an accepted layout path.
- `session-corpus.ts`'s `OVERLAID_KINDS` includes `"rulebook/"`, so a directory
  corpus source actually delivers a declared rulebook file into a session
  attempt's overlay, not just resolves and hashes it.
- `corpus-report.ts` no longer appends `"rulebook"` itself; it derives solely
  from `CORPUS_LAYOUT_DIRECTORIES`, confirmed by grep finding no
  `CORPUS_SCREEN_DIRECTORIES` or standalone append left in the file. The
  card's own record says this was a double-count bug in an earlier commit
  (0c7145d) that a later commit fixed within the same card, not a defect
  surviving into Done.
- GLOSSARY.md carries `rulebook/<name>.md` in five places, including the two
  "Corpus layout"/"Corpus layout path" entries the card named plus two more
  ("Corpus" and "Corpus overlay") that review caught as also stale and fixed
  in the same card.
- Full suite run fresh this session: 1254 + 100 pass, 0 fail. All 8 acceptance
  criteria show checked.

The bet undersold the outcome slightly: it named a re-scope-then-build risk, and
what actually happened was re-scope, build, and a same-day six-axis review that
caught two more should-fix findings (stale glossary entries beyond the two named)
and fixed them before Done, rather than leaving them as debt.

## 3. What obstacles stand between here and the goal, and which one is next?

What this run met: none. The card closed clean — built, reviewed, fixed on
review findings, all ACs checked against fresh evidence. No stopped step, no
budget exhaustion, no stand-in for the goal.

What review left open deliberately, not as debt this card owes: three
independent "layout kind" lists (`CORPUS_LAYOUT_DIRECTORIES`,
`LAYOUT_DIRECTORY_KINDS` in checkpoint.ts, `OVERLAID_KINDS` in
session-corpus.ts) still exist separately. Architecture judged this a real split
(OVERLAID_KINDS deliberately excludes skills/ pending ACT-28), not duplication
to collapse now. Worth a card only if a future layout kind needs adding to more
than one list again — not yet warranted by one instance.

The next obstacle toward m-3's actual goal is ACT-71, m-3's only other open
card: a failed stage run doesn't record which model or effort produced it,
which blocks comparability checks on failed runs specifically. It is unrelated
to ACT-60's corpus-layout work and has no dependency on it.

## 4. What is the next step, and what do you expect from it?

ACT-71, already shaped and in To Do with two acceptance criteria: a failed
judgment should record model, judge model, and both effort settings, so
reading the failed artifact alone (no card lookup) answers what produced it.
Expect it to close m-3 to 5/5, since it's the milestone's last open card.

Doc-43 also lists ACT-61 as the most-flagged item on the whole board (seventh
consecutive triage run naming it, unblocked and answered since 2026-09-07,
still sitting in Shape). It is the project-context half ACT-60 explicitly
carved itself away from, on the same context-manifest design (doc-9). Not
m-3-scoped, but the most stale item adjacent to this card's work.

## 5. When can the increment be seen?

Now. Declare a session case with a `corpusFiles` entry under `rulebook/`
against either the live source or a directory corpus source, run it, and read
the attempt record: the file resolves, appears in the corpus digest hash, and
an edit to it flips a previously-fresh checkpoint stale. `rehearsal case show`
or the corpus report screen surfaces the same file exactly once. All of this
is live on main now (commits 343f8f3 through cbf81a2), not gated behind
anything further.

## Verdict: On track

The bet held exactly: re-scope to the real directory name, then build against
the settled `checkpoint.ts` precedent. The next step (ACT-71) continues the
same milestone without any change of plan.

## Proposals

- No card to add for this work. The three-list duplication review flagged is
  noted above as a future trigger, not a card today — one instance doesn't
  yet warrant it.
- ACT-71 is already correctly queued as m-3's next and only remaining item;
  no reorder needed.

## Kaizen candidates

None new. This card closed without the claims-without-verification pattern
doc-43 is already escalating (its own final summary's claims were checked
against fresh test output and grep this session, and held).
