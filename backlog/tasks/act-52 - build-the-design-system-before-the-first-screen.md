---
id: ACT-52
title: build the design system before the first screen
status: To Do
assignee: []
created_date: '2026-09-04 13:22'
labels: []
milestone: m-1
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
- [ ] #1 Every token in SPEC.md's Design Tokens section is defined once, with a semantic name, and is referenceable from a screen
- [ ] #2 A page renders every token and every component in each of its states, viewable from a local checkout
- [ ] #3 One component renders a status as glyph plus word, and no screen composes that pair itself
- [ ] #4 The focus ring and the reduced-motion pulse replacement are defined in the system, not per screen
- [ ] #5 A check fails the build when a raw colour or spacing value appears outside the token definitions
<!-- AC:END -->
