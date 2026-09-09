---
id: ACT-144
title: build and freeze generated fixtures for session cases
status: Shape
assignee: []
created_date: '2026-09-09 15:49'
updated_date: '2026-09-09 16:33'
labels: []
milestone: m-3
dependencies: []
references:
  - src/benchmark/checks.ts
  - src/benchmark/session-lineage.ts
  - src/benchmark/case.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 140008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A copied fixture tree cannot conveniently express the triage benchmark's CLI-built board and git history. Add case-declared setup whose realized output becomes the recorded starting state. Repeatedly running identical commands is insufficient: timestamps, git identity, configuration and external inputs can change the tree or history.

Choose the declaration format and error contract during shaping. Reuse runSetup where it fits, without imposing pipeline targets on session cases. Either freeze the built state for reuse or prove equivalent realized states before comparison. Include setup inputs and the resulting tree/history identity in the evidence used for comparability. First verification target: a builder that creates committed history and board files, then changes its output across invocations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session case’s declared setup creates files and git history that the session observes in its isolated working directory (João’s approved session benchmark scope, doc-59)
- [ ] #2 Every arm sharing a fixture input receives the recorded equivalent starting tree and git history, even when independent builder invocations would produce different timestamps (João’s approved session benchmark scope, doc-59)
- [ ] #3 The run records the setup definition and realized starting-state identity so changed fixture inputs cannot be silently compared as identical (João’s approved session benchmark scope, doc-59)
- [ ] #4 A setup failure is recorded and reported before any model session starts (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. The approved triage fixture needs CLI-built board and git history; static file copying cannot run its setup.

Evidence: HEAD 3438d1f (product code unchanged from 1d02c8e). caseDeclarationSchema rejects setup as an unrecognized key in session-probes.ts; runSessionAttempt only calls seedFixture. sessionUpstreamDigest hashes a static fixture tree.

Unresolved claims/resources: No prerequisite for shaping. Claude 2.1.266 runs at /opt/homebrew/bin/claude; this session PATH omits /opt/homebrew/bin. Use a command-local PATH prefix for a future authorized provider check. Authentication and real-provider behavior remain unverified; executable presence grants no spending authority.

Next action: Shape the generated-input declaration and realized tree/history freeze with a deterministic fake builder.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
