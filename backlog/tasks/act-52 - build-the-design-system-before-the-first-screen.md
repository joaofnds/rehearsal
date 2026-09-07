---
id: ACT-52
title: build the design system before the first screen
status: Build
assignee: []
created_date: '2026-09-04 13:22'
updated_date: '2026-09-07 14:34'
labels: []
milestone: m-5
dependencies:
  - ACT-48
priority: high
ordinal: 54008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per decision-2, the design system is its own deliverable and comes before any screen.

Everything it needs is already specified in docs/design-handoff/SPEC.md, under Design Tokens and scattered through the screen sections. Nothing here is invented:

Tokens. The colour table with roles (canvas, surface, surface alt, sidebar, row hover, four border weights, six text weights, five accent values, accent tints, diff add/remove). The type scale, seventeen steps from 9 to 30, with Inter for UI and JetBrains Mono for every identifier, hash, path, grade, cost, duration, count, and quoted span. The nineteen-value spacing scale. Seven radii. Border weights, including the 1px-dashed-plus-opacity treatment that means planned. One shadow, dialogs only. Scrollbar styling.

Components the spec names by use, each needed by more than one screen:
- status glyph + word (the vocabulary: accepted, running, queued, stopped, interrupted, fired, clear, stale, pending, checkpoint present/absent)
- grade display, in its several sizes
- corpus pill
- section label (10px uppercase .09em)
- filter pill with pressed state
- evidence disclosure (the toggle, the 2px left border block, source chip, locator link, quoted span)
- step node card
- stat card
- planned-feature block (dashed border, opacity, PLANNED pill)
- dialog shell (focus trap, Esc affordance, focus restore)
- table shell (sticky head, row separators, hover, caption as section label)

Behaviour that belongs in the system rather than in screens: the focus ring, the pulse animation with its prefers-reduced-motion replacement, and the rule that hover never reveals content.

The status component is the load-bearing one. The product rule that colour never carries meaning alone holds because one component renders every state as glyph plus word, not because nine screens each remember to.

Do not build this speculatively wide. Build the tokens in full, since they are enumerated, and build a component when the first screen needs it, in the system rather than in the screen. What must not happen is a screen defining its own.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every token in SPEC.md's Design Tokens section is defined once as a CSS custom property with a semantic name, and a screen references it by name rather than a raw value (decision-3: tokens are CSS custom properties, not Tailwind)
- [ ] #2 A standalone page under client/, run with vite dev, renders every token swatch and every component in every state SPEC.md and decision-2 name, viewable in a browser from a local checkout with no server running
- [ ] #3 One status component renders every state SPEC.md's status vocabulary lists (accepted, running, queued, stopped, interrupted, fired, clear, stale, pending, checkpoint present/absent) as glyph plus word, and nothing outside that component composes the pair
- [ ] #4 The focus ring (2px solid accent, 2px offset, on :focus-visible) and the pulse animation with its prefers-reduced-motion static-glyph replacement are defined once in the system's CSS and used by reference, not redefined per component
- [ ] #5 A stylelint run over client/ fails on a hex color written outside the token custom-property definitions (via color-no-hex) and on a bare px/rem length written on a spacing- or sizing-accepting property outside them (via declaration-property-unit-disallowed-list), and passes on the system page and every component (decision-3's 'one rule over CSS files', read as one rule set)
- [ ] #6 Only the components Run history (ACT-53) needs are built: status glyph+word, grade display, corpus pill, section label, filter pill, table shell -- the six the card's own description names that Run history's columns and filter bar use. The other five the card names (evidence disclosure, step node card, stat card, planned-feature block, dialog shell) are tokens-and-states documented on the system page as not yet built, each against the screen card that will need it first
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-07, corrected 2026-09-07 after adversarial-review (reviewer agent) found a fabricated citation, unmerged duplicate acceptance criteria, and an unresolved lint mechanism in the first draft. Nothing here is invented past what decision-2, decision-3, SPEC.md, and the card's own prior description already settle; the only real unknowns were sequencing and the raw-value check's mechanism.

Stack: this card creates client/ as the real Vite+React project ACT-53 builds on (adds Hono, TanStack Query/Router, routes, the server), not a throwaway scaffold ACT-53 replaces. Rework avoided: one scaffold, not two. Confirmed against ACT-53's own text ("the design system from ACT-52, with every value coming from it") -- no mismatch. package.json gains vite, react, react-dom, @types/react, @types/react-dom, typescript already present; tsconfig gets a client-facing config with jsx react-jsx, since the root tsconfig has noEmit and bun-types only.

Raw-value check (AC #5): stylelint, per decision-3's "one rule over CSS files." Correction: catching this needs two stylelint rules, not one -- color-no-hex for raw colors, declaration-property-unit-disallowed-list (scoped to spacing/sizing properties: padding, margin, gap, inset/top/right/bottom/left, width, height, border-width, font-size) for bare px/rem lengths. declaration-property-value-disallowed-list, the rule this note first proposed, takes a per-property value list and does not scan every declaration by default, so it alone would not catch both without an exhaustive property enumeration nobody has written. Read decision-3's "one rule" as one rule set enforcing one policy, not literally a single stylelint rule name; the record here is what a fresh session needs, so it names both rules rather than leaving the gap silent. No CSS linter exists in the repo today (checked package.json, bun.lock, .oxlintrc.json -- oxlint covers JS/TS only, plugins are typescript/unicorn/oxc/import/promise/node). This is a new devDependency; decision-3 already named the rule to write, so this card is picking the tool and its exact rule pair, not deciding whether to add one.

Scope of components (AC #6): decision-2 (lines 44-46) names ten: corpus pill, grade display, status glyph+word, evidence disclosure, node card, section label, filter pill, planned-feature block, stat card, dialog. The card's own prior description adds an eleventh, table shell, which decision-2 does not name but the card's line 36 does -- the card is the authority a fresh session builds from, so both sources count. (First draft of this note miscounted decision-2 alone as eleven; corrected.) Cross-referencing SPEC.md's Run history section (section 1) against ACT-53's actual scope (Run history only, m-5's stated goal per doc-7) narrows the eleven to six: status glyph+word, grade display, corpus pill, section label, filter pill, table shell -- everything Run history's columns and filter bar actually use. Building the other five (evidence disclosure, step node card, stat card, planned-feature block, dialog shell) now would be speculative width the card's own description forbids ("build a component when the first screen needs it"). Each undone one is named on the system page against the screen card that introduces it, so a later session doesn't have to re-derive the list: evidence disclosure and step node card -> live monitor (ACT-51), stat card -> run detail (unfiled, split out of ACT-50's original six-screen scope per its own triage note), planned-feature block -> corpus screen (ACT-50), dialog shell -> step modal, first needed by the live monitor's node action stack (ACT-51).

Tokens are built in full regardless (card's own instruction: "build the tokens in full, since they are enumerated"), including tokens only used by undone components (e.g. diff add/remove, shadow), since SPEC.md enumerates the whole set and a partial token file is exactly the drift decision-2 exists to prevent.

Fonts and icons (flagged by review as unaddressed): SPEC.md's Assets section names Inter and JetBrains Mono, self-hosted rather than Google-Fonts-linked ("this tool runs locally and should not need network access"), and Phosphor Icons 2.1.1 installed as a package rather than CDN-linked. Both are needed the moment the system page renders any text or status glyph (AC #2), so they are in this card's scope, not deferred: self-host the two font files under client/ and install @phosphor-icons/react (or the closest maintained React binding) as a dependency. This was a real gap in the first draft, now closed rather than left silent.

Radix (decision-3 names it for dialog focus-trap and disclosure semantics): not installed by this card. The two components that would need it, dialog shell and evidence disclosure, are both in the deferred five, so Radix is added when ACT-51/ACT-50 first build them, not speculatively here.

Glossary: no new terms. Checked the full GLOSSARY.md; "design system," "token," and "component" have no existing entries under any name in this repo, so the card's plain SPEC.md/decision-2 usage doesn't collide with anything.

First test to write: a stylelint test fixture with one bare hex color and one bare px padding value in a client/ CSS file, asserting both configured rules report them -- this is what proves AC #5 before any component exists, so it should be the first thing built.

Approach: only one way to build this survives -- decision-2 and decision-3 already picked tokens-as-CSS-custom-properties, React+Vite, and the exact component list; there was no second option to weigh here, only the sequencing and tooling questions above.

Review: adversarial-review (reviewer agent), 2026-09-07. Findings and disposition -- blocking: none. Should-fix, all folded: "table shell" citation was wrong (decision-2 has ten, not eleven; the eleventh is the card's own text, not decision-2's) -- fixed above; stylelint mechanism only caught one of colors/spacing -- fixed above with the two-rule pair; ACs #1-5 were left in place alongside the corrected #6-10, giving the card ten overlapping criteria for five behaviors -- fixed by replacing the criteria field outright rather than appending, board rule per backlog-board.md ("every value flag... replaces its field"); the "Scope of components" paragraph was mislabeled as documenting AC #6 when it documents the components AC (now AC #6 after the replacement, so the mislabel is resolved by the renumbering). Note-level, folded: fonts/icons/Phosphor were unaddressed -- fixed above; Radix's omission was correct but unstated -- now stated with its reason.

Iteration stopped 2026-09-07 before build. The shaping is sound and is not what stopped it. CLAUDE.md's Stack line says 'No framework, no database, no server'; decision-3 (accepted) chooses React, Vite, Hono, and SQLite, and this card is the one that first installs a framework. Criterion 2 keeps the page server-free and nothing here adds a database, so the live collision is the framework line alone. CLAUDE.md outranks the rulebook, and decision-3 is a later and more specific statement about this exact work; nothing states which wins, so the session did not infer a ranking. Needs João's call before build installs React and Vite.

Unblocked 2026-09-07: João directed the CLAUDE.md stack line to be scoped to the CLI and harness, so the UI's dependencies follow decision-3 and this card does not reargue them. Committed in this repo. The line's first draft listed four of the seven dependencies decision-3 adopts, which would have sent this card to argue for TanStack Query, Table, Router, and Radix; an independent review of the instruction edit caught that before it landed.

Review 2026-09-07: review-code skill, six reviewers (spec conformance, style, architecture, security, testing, refactoring), each given the diff and this card's goal, no cross-priming. Full findings and verification commands are in each reviewer's own report (not persisted past this session); this note carries the disposition.

No blocking findings from any axis. Security: nothing found (no untrusted-input path exists in a local-only presentational scaffold). Disposed, all in this task's own commits:
- table-shell.tsx used row.join('|') as a React key (style+refactoring, both independently found it): two rows with identical or pipe-containing cells collide. Fixed: array-index key, since TableShell is a generic shell with no row identity of its own.
- Grade's value prop was a bare string with a 'pending' string sentinel (style+architecture, both independently found it): nothing prevented a real grade letter equal to the literal 'pending'. Fixed: value is now GradeValue = { letter: string } | { pending: true }, a real discriminated union.
- Grade accepted sizes 12 and 26px, but SPEC.md's type scale names 26px as the spend figure (weight 500), never a grade, and 12px has no grade citation at all; Grade renders every size at weight 700 unconditionally (spec). Fixed: removed both from GRADE_SIZES; only SPEC.md-cited grade sizes remain (13/19/20/22/24/30).
- .rh-hoverable (unused) reached for --color-accent-tint-16 (the selected/pressed tint) where SPEC.md's own button-hover rule names a distinct rgba(145,132,217,.14), a value with no token (spec). Fixed: added --color-accent-tint-14, wired .rh-hoverable onto FilterPill (the one interactive component in this diff with no hover treatment, also a spec note).
- table-shell.css and globals.css both hardcoded the same row-hover rule for the same elements (spec). Fixed: removed the duplicate from table-shell.css; globals.css's .rh-row:hover is the one owner.
- status.css had a no-op rule restating the base color for two states (spec/refactoring note). Fixed: removed.
- System page had no swatch for the Border, Shadow, Scrollbar, or Letter-spacing token categories SPEC.md's Design Tokens section and decision-2 point 4 both name (refactoring, a real AC #2 gap). Fixed: added all four sections; added a LETTER_SPACING_TOKENS list (also caught --color-accent-tint-14 missing from COLOR_TOKENS while wiring the parity test below).
- bun run typecheck (root tsc --noEmit) never covered client/, so a client-side type error passed silently (architecture, verified by injecting one and confirming it wasn't caught, then confirming the fix catches it). Fixed: typecheck now runs both project configs.
- token-names.ts and tokens.css list the same token names by hand with nothing enforcing parity (architecture). Fixed: added token-names.test.ts, a parity test that parses tokens.css's declared custom properties and checks both directions against the *_TOKENS exports. Writing it caught a real, live instance of the predicted drift: --color-accent-tint-14 (added earlier in this same review pass) was missing from COLOR_TOKENS until the test failed on it.
- system-page.test.tsx's status-state coverage used a for loop instead of it.each, and two tests each bundled several unrelated component-presence assertions, and four assertions used unanchored substring regexes that a mutation test (run by the testing reviewer) showed pass even when the exact label text changes (testing, all three should-fix). Fixed: it.each for both status states and grade sizes, one behavior per test, exact-text matches.
- ACT-94's card named only src/cli/rehearsal-cli.test.ts and 'every failing test goes through runCli' (spec, verified by a fresh count: 48 total, 47 there, 1 in src/benchmark/benchmark-command.test.ts:86, same root cause). Fixed: corrected ACT-94's title, AC, and notes.

Not fixed, investigated and recorded as a known accepted coupling: bunfig.toml's [test] preload registers happy-dom/testing-library globally for every bun test invocation in the repo, not just client/ (architecture). Bun 1.4.0 has no per-glob or per-directory preload scoping (checked: no CLI flag, no bunfig key). Tried the alternative the reviewer proposed, a per-file side-effect import of client/test-setup.ts at the top of each client test file instead of the global preload: it does not work, because @testing-library/react's own static import (also at file top) evaluates before the side-effect import reliably wins that race in Bun's module graph, reintroducing the exact 'document has to be available' failure the preload exists to prevent (reproduced, then reverted). The global preload is therefore the only mechanism available, not a shortcut. Confirmed non-breaking: full bun test before and after this task, both runs, show the identical 48 pre-existing CLI failures (ACT-94), none of them related to fetch/document/window. Not tracked as a separate card since there is no fix to track without a Bun capability that does not exist today; revisit if a future Bun version adds scoped preloads.

Not a defect: @phosphor-icons/react installed with no current call site (style). The card's own implementation notes require installing it now regardless of use ('needed the moment the system page renders any text or status glyph'), matching the fonts it's installed alongside.

Not reproduced: a one-off stylelint phantom failure the refactoring reviewer saw once and could not reproduce in 20 follow-up runs (note only, no action).
<!-- SECTION:NOTES:END -->
