---
id: doc-45
title: 'reflection: ACT-61'
type: other
created_date: '2026-09-08 20:16'
---

# Reflection, ACT-61 (record the project half of the context manifest)

## 1. What is the target condition?

ACT-61 belongs to m-3, "Tell a real corpus improvement from noise," and closes
the third and last card doc-9 named: ACT-59 (observe and reconcile the corpus
half), ACT-60 (carry `rules/` into the corpus layout, still open), ACT-61 (the
project half). The bet, from the card's own Implementation Notes: a session
case declares its target's own project instructions and documents explicitly,
and its attempt's context manifest reports what actually loaded from that
declared set, tagged corpus-half or project-half, so a corpus A/B is checkable
against project-document drift the same way ACT-59 made corpus divergence
checkable.

## 2. What is the actual condition now?

Matches the bet, verified directly this session, not relayed from the card's
record. `projectFiles: string[]` is a session-case field mirroring
`corpusFiles`. `ManifestEntry` carries `{ path, half }` as one tagged shape,
not two parallel lists. `observedManifest` classifies a Read as project-half
only when it matches a declared project file and is not already claimed by
the corpus classifier, closing the double-tag and misclassification bugs the
first draft had. `reconcileManifest`'s one production call site
(`session-run-command.ts:179`) reconciles against the union of both halves,
which was the review's own correction to the Notes' original wording (the
Notes had said `recordAttempt` was "the one call site to update," true only
for the observing half, not the reconciling half). I confirmed that union is
actually wired, not just described. Full suite green on a fresh run (1264
backend + 100 client, this session's own run, not the record's cached 1272 —
the count differs, most likely from unrelated work landing on main since;
nothing in this card's own tests is failing). Typecheck clean. Lint clean
except the two `doctrine-ab-*` fixture files the card's own notes named as
pre-existing and out of path, which I confirmed by running lint myself rather
than trusting the claim.

One gap the card surfaced but did not close, by explicit direction: a
pipeline stage's own transcript is never captured today, so a pipeline
stage's context manifest is structurally unreachable. Filed as ACT-123,
unblocked, no dependency edge to ACT-61. Confirmed the card exists and is
in To Do.

One accepted residual: a multi-segment declared project file can suffix-match
an unrelated file at a different depth. Documented in the code's own comment,
reasoned as case-author-trust, same basis the corpus half already carries.
No consumer needs multi-segment declared paths today, so this is a reasonable
call, not a gap to send back.

## 3. What obstacles stand between here and the goal, and which one is next?

None on this card's own path. It shipped, reviewed (six-axis, every finding
disposed), and closed clean. The obstacle is now one level up: m-3's second
card, ACT-60 (carry `rules/` into the corpus layout), is still open, and
triage (doc-43) already found its premise stale — `~/.agents/rules/` no
longer exists, replaced by `~/.agents/rulebook/`, so the card needs
re-scoping against what a session actually loads today before anyone builds
it. That re-scoping is the next obstacle on doc-9's own path, not a new one
this card found.

## 4. What is the next step, and what do you expect from it?

ACT-60, re-scoped first. Triage already named the fix: read what
`~/.agents/rulebook/` actually contains and what a live session actually
loads from it, before writing the card's acceptance criteria against a
directory that no longer exists. Expected observation: the corpus layout
gains whatever `rulebook/`-sourced paths a real transcript shows a session
reading, and ACT-59/ACT-61's reconciliation machinery reports any of them the
case fails to declare, the same way it already does for skills and project
files.

## 5. When can the increment be seen?

Now, without a live run: `context-manifest.test.ts` and
`session-attempt.test.ts` exercise the tagged manifest and the
declare-versus-observe divergence against a committed fixture, no provider
call. Reading `src/benchmark/context-manifest.ts` shows the two-halves
concept as code. What is not yet seen: a real session declaring
`projectFiles` and having its manifest checked in a live run, or a live
corpus A/B where a project-document edit shows up as a reported divergence
end to end. Both need a real run, which this reflection did not spend budget
on, matching the card's own "not verified" note.

## Verdict: On track

The bet held, and the build closed clean with no unresolved finding. m-3's
own goal (tell a real corpus improvement from noise) advances exactly as
doc-9 planned: the project half is now checkable the way the corpus half
already was. The next step is a re-scope, not a new direction.

## Proposals

- Move ACT-60 to the front of the ready queue for m-3, now that ACT-59 and
  ACT-61 are both closed and the corpus-layout coverage it needs to extend is
  fully checkable. Reason: doc-9 named it explicitly as the mechanical
  extension that follows once the manifest reports what corpus-half coverage
  is missing, and triage has already done the re-scoping legwork (found
  `rulebook/` replacing `rules/`).
- No card to close or split. ACT-123 is already correctly filed and
  unblocked; nothing here duplicates it.

## Kaizen candidate

None new. The escalating claims-without-verification pattern triage is
already tracking (doc-43) did not recur here: this card's own record
distinguished verified claims from inference at every turn (the "not
verified: no live Claude session was run" line, the explicit correction to
its own Notes section found by review). Naming this as a positive instance
of the practice triage wants more of, not a new finding.
