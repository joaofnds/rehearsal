---
id: ACT-52
title: build the design system before the first screen
status: Build
assignee: []
created_date: '2026-09-04 13:22'
updated_date: '2026-09-07 13:57'
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
<!-- SECTION:NOTES:END -->
