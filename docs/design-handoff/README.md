# Design handoff

`SPEC.md` is the specification produced by Claude Design on 2026-09-04, from the
brief in `docs/ui-design-prompt.md`. `prototype.html` is the design reference it
came with: intended look, structure, and behavior.

The prototype is a reference, not production code. It was built on a streaming
template runtime that exists only in the design environment; that runtime
(`support.js`) is deliberately not vendored here, because the spec says not to
port it and a file nobody may use is a file someone will eventually use.

The prototype does not render standalone without that runtime. Read `SPEC.md`
for everything; open the prototype in the design tool when a detail is
ambiguous.

`SPEC.md` describes a product wider than the harness currently is, and it
renames the domain. Neither is a defect in the spec. Both are decisions on the
board: ACT-47 settles the vocabulary, ACT-48 sizes the gap between what the
spec's screens read and what the harness records.
