---
id: ACT-145
title: grade and preserve post-session files and git state
status: To Do
assignee: []
created_date: '2026-09-09 15:49'
labels: []
dependencies: []
references:
  - src/benchmark/session-attempt.ts
  - src/benchmark/session-check.ts
  - src/benchmark/session-record.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 141008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The triage benchmark grades card status, priority, dependencies, archives, documents, ready ordering and tree cleanliness. evaluateChecks currently sees only the reply and tool uses. recordAttempt evaluates checks before cleanup, but removes the working tree and suppresses all checks when there is no final reply.

Add case-declared command scorers with named results and retain the resulting files and git state before executing a grader. Each grading pass must leave that saved evidence intact, including when a grader writes files or changes the index. Separate session completion from available state grades and from grader launch, timeout or malformed-output failures. The scorer belongs to the case's grading definition; session edits must not silently redefine it. Keep board-specific knowledge in fixture/scorer data.

The saved evidence must include the dirty, untracked and relevant ignored state required by declared checks as well as git history; a commit or textual diff alone cannot reconstruct tree-cleanliness checks. Specify retention and scorer output formats during shaping. First verification target: a runner edits a board then returns no reply, followed by a grader that mutates its own working directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A command scorer grades the files and git state left by a session and records a separate named result for each declared outcome (João’s approved session benchmark scope, doc-59)
- [ ] #2 The preserved evidence reconstructs the state consumed by the original scorer, including committed history and working-tree changes (João’s approved session benchmark scope, doc-59)
- [ ] #3 A grader that changes files or git state does not change the saved session evidence or the input seen by a later grading pass (João’s approved session benchmark scope, doc-59)
- [ ] #4 A session ending without a final reply still receives available state-check results while its incomplete session outcome remains visible (João’s approved session benchmark scope, doc-59)
- [ ] #5 A grader that cannot execute or returns invalid results is identified as a grading error rather than a failed skill outcome (João’s approved session benchmark scope, doc-59)
- [ ] #6 A session edit to a scorer file cannot silently change the grading definition used for its result (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->
