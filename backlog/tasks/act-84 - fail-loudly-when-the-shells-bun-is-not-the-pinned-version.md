---
id: ACT-84
title: fail loudly when the shell's bun is not the pinned version
status: To Do
assignee: []
created_date: '2026-09-05 21:09'
updated_date: '2026-09-05 21:09'
labels: []
dependencies: []
priority: medium
type: chore
ordinal: 80008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running the test suite under a Bun version other than the pinned one reports the mismatch by name instead of failing unrelated tests
- [ ] #2 The mismatch is visible without the operator knowing to compare versions themselves
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed 2026-09-05 during ACT-45's build session. The shell's default bun was 1.4.1 against the repository's 1.4.0 pin, and 47 unrelated tests failed silently until mise was activated. Nothing named the version as the cause, so the failures read as real defects in the code under test.

This is a poka-yoke gap. A version mismatch is a condition the system can detect and refuse, and today it is left to the operator noticing that a suite which should be green is not. The cost is a session spent chasing 47 phantom failures, which is what nearly happened.

Reproduce by running the suite with a bun that is not the pinned version and observing that the failures name assertions rather than the version.
<!-- SECTION:NOTES:END -->
