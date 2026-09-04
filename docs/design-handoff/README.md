# Design handoff

`SPEC.md` is the specification Claude Design produced on 2026-09-04, from the
brief in `docs/ui-design-prompt.md`. It is the authority: read it for
everything.

`prototype.html` is the design reference it shipped with. Open it from a local
checkout to see the intended look, structure, and behavior of all nine screens.

`support.js` is the design environment's streaming-template runtime. It is here
only because the prototype does not render without it: the markup is custom
elements the runtime expands. **Do not port it, and do not import it into the
application.** The spec says so directly, and the prototype's own header calls
itself a reference rather than production code.

The spec describes a product wider than the harness currently is, and it renames
the domain. Neither is a defect. Both are decisions on the board: ACT-48 settles
the vocabulary against the glossary, ACT-49 inventories what the design shows
that the harness cannot yet supply.
