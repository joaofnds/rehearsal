---
id: doc-27
title: 'reflection: ACT-63'
type: other
created_date: '2026-09-07 01:30'
---

# Reflection: ACT-63

## 1. Target condition

Milestone m-1 (doc-6): prove the loop once, run a stage, edit an instruction,
replay, and read a comparison. ACT-63's bet, from doc-23's queue line: fix a
latent corpus-root defect, independent of ACT-73/74/76, so a run or replay
against a case target whose repository carries its own `.claude` searches the
target's project corpus rather than the control repository's or the user's by
accident.

## 2. Actual condition now

Matches the bet, and the fix went one step further than filed. Verified
directly against current code: `corpusLayoutRoots` and `stageCorpusRoots` take
only a target/source root, no `CONTROL_DIR` argument exists at either call
site (`run-command.ts:294`, `replay-command.ts:175`), and both resolve through
`inputs.source.root` / `manifest.sourceRoot`. `staleness-report.ts`'s
live-corpus check now compares against `source.root` directly rather than
calling `stageCorpusRoots` with a sentinel. Fresh run this session: full suite
1063/1063, typecheck clean, lint clean.

Two review rounds after the initial fix found and closed two further defects
in the fix itself, not new instances of the original bug: a two-purpose
sentinel parameter, and a duplicated path expression. The card closed only
after both were reverted to single-purpose code.

## 3. Obstacles and what's next

The card met no obstacle proving its own bet; the corpus-root search now
proven correct by direct resolution and by running `stale`. What it did meet,
twice, was review finding defects introduced by the fix's own first shape,
each requiring a further commit before Done. That is closed work, not a
carried obstacle.

Two follow-on gaps came out of this card's own review and are already filed,
unaffected by this fix: ACT-92 (executeReplay's real wiring of corpusRoots has
no test driving the production path, only fakes) and ACT-93 (stale's
live-corpus branch has no test). Neither blocks m-1's own goal, since both are
coverage gaps on code already confirmed correct by direct resolution this
session, but both are real defects if a future refactor moves the wiring.

## 4. Next step

No change to doc-23's queue. ACT-73, ACT-74, ACT-76 remain the cards that
block trusting m-1's comparison output, independent of this one and of each
other; they're the next bet. ACT-92 and ACT-93 are cheap, parallel-safe test
additions with no milestone urgency; recommend folding one or both into
whichever session next touches `checkpoint.ts` or `replay-command.ts`, rather
than a dedicated session.

## 5. When can the increment be seen

Now: `rehearsal stale` against a run whose manifest names a real target
resolves the live branch to that target's root, observable by running it (done
this session). The three m-1-blocking cards (ACT-73/74/76) are what still
needs a session before the loop's comparison output itself can be trusted.

## Verdict

**On track.** The bet held: the corpus-root conflation is gone from every call
site, verified by direct resolution and a fresh full-suite run. No evidence
here bears on m-1's goal itself.

## Proposals

- No card to add for ACT-63's own defect; fully closed.
- No reorder: ACT-92 and ACT-93 already sit in To Do, unmilestoned/m-1
  respectively, correctly not ahead of ACT-73/74/76 in urgency.
- Kaizen candidate, one line: this card's fix needed two extra review-driven
  commits to reach single-purpose code; a sentinel-argument smell (an
  `undefined` branch standing for a different caller's intent) is worth a
  named check in review-code's architecture axis if it recurs.
