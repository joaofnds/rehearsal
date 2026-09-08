---
id: doc-39
title: 'reflection: ACT-59'
type: other
created_date: '2026-09-08 11:57'
---

# Reflection: ACT-59

## 1. Target condition

Milestone m-3, per doc-9: close gap 1 of the context manifest design — observe
what an attempt's transcript actually loaded and reconcile it, name-against-name,
against the case's declared `corpusFiles`, so a divergence is reported instead
of silently recorded as a corpus the session never read. The bet (doc-9's own
ordering rationale): this is the cheapest of the three gaps, reads only records
already on disk, and its output is what tells the next two cards (ACT-60's
`rules/` coverage, ACT-61's project half) what is actually missing, rather than
guessing.

## 2. Actual condition now

Matches the bet. Verified directly this session, not only from the card's
notes: full suite green (1192 + 99 tests), and the manifest-probe case's three
recorded attempts on disk carry exactly what the card claims — a clean run's
`attempt.json` shows `contextManifest.paths: [skills/verify/SKILL.md,
output-styles/brief.md]` with `divergences: []`; the run against a modified
declaration (an undeclared `skills/shape/SKILL.md`) shows the same paths with
`divergences: [{kind: unloaded-file, path: skills/shape/SKILL.md}]`. Both
outputs are real attempt records, not fixtures. Reconciliation is
name-against-name as designed; no transcript bytes are compared against corpus
bytes anywhere in the implementation.

The build's review record shows the harder part of this bet was catching where
the implementation would have been silently wrong: a transcript-prefix leak
that would have produced false divergences on resumed sessions (the exact
shape ACT-59's own test fixture uses), and a `CLAUDE.md` blind spot in the
layout predicate that would have false-flagged any case declaring it. Both
were caught by review, fixed, and each fix carries a regression test that
fails when the fix is reverted — confirmed live for the prefix-leak fix by
the overseeing session re-planting the bug and watching the test catch it.

## 3. Obstacles and what's next

The run met no stopped step; it reached Done with all 8 acceptance criteria
checked and a second, independent verification pass. What became possible and
is now wired: ACT-60 (`rules/` in the corpus layout) and ACT-61 (project-half
manifest) are both unblocked and can now build against real observed-divergence
evidence instead of a guessed list of missing kinds.

What became possible and is *not* wired: nothing in this card's own scope.
But the verification pass surfaced a genuine gap in the surrounding
infrastructure, filed as ACT-118 — a session case's transcript prefix must
exist both as a committed fixture (`cases/<id>/`, which ACT-59's own AC#7 test
reads) and as harness-runtime state (`.benchmark-runs/cases/<id>/`, which
`.gitignore` excludes). The manifest-probe case only runs today because the
overseeing session copied the file by hand; a fresh clone cannot run it. This
blocks nothing about ACT-59's own correctness (verified above), but it does
mean ACT-60 and ACT-61, if they extend the manifest-probe fixture rather than
writing a new one, will hit the same wall.

The next obstacle for the goal (m-3, the context manifest) is ACT-60: closing
the `rules/` coverage gap doc-9 identified, now that ACT-59 supplies the
mechanism to detect it rather than guess at it.

## 4. Next step

ACT-60, as already queued and ordered (depends on ACT-59, now satisfied).
Expect it to add `rules/` to `CORPUS_LAYOUT_PREFIXES`, then run a case that
loads a rule file and confirm the manifest reports it without a divergence,
and a case that edits a declared rule file shows the downstream checkpoint as
stale via `rehearsal stale`. Before or alongside it, ACT-118 is worth a small
card of its own: it blocks nothing today but will block any fresh-clone run
of a session case with a committed prefix, which is the exact shape ACT-60
and ACT-61's own tests are likely to need.

## 5. Seeing the increment

Already visible, checked this session: `.benchmark-runs/sessions/manifest-probe/*/attempt.json`
on this checkout carries the `contextManifest` and `divergences` fields with
the values shown above. A fresh clone cannot reproduce the run itself yet
(ACT-118), but the recorded evidence from the runs already made is there to
read now.

## Verdict: On track

The bet held: the manifest is real, observed from disk records only, reports
exactly the divergence shapes doc-9 asked for, and review caught two defects
that would have made the design's own foundational claim (frozen inputs are
known to be the whole input set) false in exactly the cases the design most
needs it to hold for (a resumed session, a case declaring `CLAUDE.md`). The
plan for m-3 is unchanged: ACT-60 next, ACT-61 after, per doc-9's ordering.

## Proposals for triage

- No card to add for ACT-59's own scope; ACT-118 is already filed and queued
  (Medium, To Do) and needs no restatement here.
- Consider sequencing ACT-118 before or alongside ACT-60/ACT-61 if either
  extends the manifest-probe fixture: both will otherwise inherit the same
  fresh-clone gap ACT-118 names, and fixing it once now is cheaper than
  discovering it again per card.

## Kaizen candidate

None new. The process defect class already tracked in doc-33/doc-36/doc-38
(a card's own notes asserting a fact that direct inspection contradicts) does
not apply here — ACT-59's own notes were checked point-by-point against live
attempt records and held.
