---
id: decision-2
title: 'The UI is built on a design system, never on bespoke per-screen styles'
date: '2026-09-04 13:22'
status: accepted
---
## Context

The UI is nine screens built over many sessions, each one arriving with its own
card. That is the exact shape of work that accumulates bespoke styling: a
session builds the screen in front of it, reaches for a hex value or a padding
that looks right, and the next session does the same a few pixels off. Nothing
in the acceptance criteria of a screen card catches it, because each screen
looks correct on its own.

`docs/design-handoff/SPEC.md` already supplies the system. It names the colors
as tokens with their roles, a type scale of seventeen steps, a nineteen-value
spacing scale, seven radii, and the border, shadow, and scrollbar treatments.
It also names the parts that are behavioral rather than visual: the status
vocabulary where every state carries a glyph and a word, the dashed-border and
`PLANNED` pill treatment for features that are drawn but not wired, the focus
ring, and the rule that hover never reveals content.

The house frontend style already requires this. Its first section is that
tokens are the single source of truth, that semantic tokens are referenced at
the call site rather than raw values, and that components come from a real
component layer rather than being hand-rolled per feature.

João stated it as a hard requirement on 2026-09-04: build and maintain and use
a design system, do not keep building bespoke styles while going through the
screens.

## Decision

The design system is built first, as its own deliverable, and every screen is
assembled from it.

1. **Tokens are the only source of visual values.** Color, spacing, type,
   radius, border, and shadow come from `SPEC.md`'s token set, defined once.
   A screen references a semantic token, never a raw value. A hex code, a
   pixel padding, or a font size written inline in a screen is a defect.

2. **Every repeated element is a component before it is used twice.** The spec
   already names them: the corpus pill, the grade display, the status glyph and
   word pair, the evidence disclosure, the node card, the section label, the
   filter pill, the planned-feature block, the stat card, the dialog. A second
   screen needing one takes the existing component or changes it, and never
   copies it.

3. **The status vocabulary is part of the system, not per-screen prose.** The
   glyph-and-word pairs are defined once and rendered by one component, because
   the product rule that color never carries meaning alone is enforced by that
   component existing, not by each screen remembering.

4. **The system is documented and viewable.** Whatever renders it, there is one
   place that shows every token and every component in its states. A session
   that cannot see what already exists will build a second version of it.

5. **A new value or a new component is a deliberate addition to the system**,
   made in the system, with the reason. It is never introduced inside a screen.

## Consequences

The first UI card is larger than it would otherwise be, because the system
comes before the first screen. That cost is paid once. The alternative is nine
screens of drift and a later pass to unify them, which is the more expensive
order and the one that usually does not happen.

Every screen card inherits an acceptance criterion: it introduces no raw visual
value and no duplicated component. A review that finds one treats it as a
defect in the change rather than a matter of taste.

The system is bounded by `SPEC.md` rather than invented. Where the spec is
silent, the house frontend style governs, and where both are silent the gap is
named rather than filled with a guess.

This decision is about the UI's construction, not its content. What each screen
shows is settled by the spec and the cards; how it is built is settled here.
