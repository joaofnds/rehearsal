---
id: ACT-83
title: settle the record and CLI protocols before outside adoption
status: To Do
assignee: []
created_date: '2026-09-05 20:46'
updated_date: '2026-09-05 20:49'
labels:
  - deferred-until-beta
dependencies: []
priority: low
type: chore
ordinal: 79008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every record the harness writes to disk carries a schema version, and a reader given a version it does not know says so by name instead of failing on a missing field
- [ ] #2 A documented list names which surfaces are promised to outside users and which are internal, so a reader can tell without reading the source
- [ ] #3 Adding a field to a promised record does not require a version bump, and removing or retyping one does, with that rule written down
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Raised by João, 2026-09-05, while settling ACT-45: 'we should really stop and think about the protocols because this will be super important for the health and future of the application as I want people to adopt this, and one of the most important things are the interfaces.'

Surveyed this session. The evidence:

Only the comparison report is versioned. src/benchmark/comparison-record.ts carries schemaVersion 1 and 2 in a discriminated union with a legacy schema kept alive, and parseComparisonReport reads both. That is the one record that already had to migrate, and it is the proof the problem is real rather than hypothetical.

The run artifact is not versioned. RunArtifactEvidence (src/benchmark/contracts.ts:399) is a 35-field interface with no schemaVersion, no zod schema, and nothing that parses it back from disk. It is written as a TypeScript type and read as whatever the reader assumes. Every recorded run in .benchmark-runs is already in this format, so a change to it silently reinterprets history rather than rejecting it.

The case schema (src/benchmark/case.ts) is not versioned either, and cases are the format outside adopters would author by hand. That is the surface most exposed to other people and the least protected.

The confirmation record writes schemaVersion 1 (src/benchmark/pipeline-confirmation.ts) but nothing reads it back, so the version is recorded and never checked.

Nothing states which surfaces are public. The CLI commands, the case format, the run artifact, and the JSON output modes are all equally reachable and equally undocumented as promises.

Scope note: this is a shaping question, not a build. The work is deciding what is promised and writing the versioning rule down, then a card per surface to bring it under that rule. Do not start by adding version fields everywhere.

Decision, 2026-09-05 (João, in session): deferred until beta, deliberately.

João: 'we should settle on the shape of the schemas and everything, but not until we have at least a beta version of the product. Like we should not try to settle things down now because I don't want to keep bumping versions whenever we need to change something. We are in active development and we should allow for the interfaces to naturally evolve. And then when we have a good version of the product, then we can version the interfaces and start to really make promises about keeping compatibility with them.'

The reasoning: versioning a record is a promise of compatibility, and a promise made during active development gets broken or gets paid for with legacy schemas nobody wants. The comparison report is the existing example of that cost. Its schemaVersion 1 branch and legacyComparisonReportSchema are kept alive in src/benchmark/comparison-record.ts for records that predate a change made during development, which is exactly the tax this decision avoids paying on every other surface.

This is the doctrine's Explore phase (3X) and last-responsible-moment: the interfaces stay free to change until the product is good enough that compatibility is worth something.

What this card is NOT: it is not blocked on discovery, and no work on it is waiting for information. It is waiting for a product milestone. Do not pick it up from the ready queue.

The trigger to reopen: a beta, meaning a version the harness's records are worth promising to an outside user. At that point this card shapes as originally written, deciding what is promised and writing the versioning rule, then a card per surface.

What holds in the meantime, and costs nothing: records may change shape freely, and a reader that meets a shape it does not understand should say so rather than misread it. That is a failure-mode property, not a compatibility promise, so it does not conflict with this decision.
<!-- SECTION:NOTES:END -->
