---
id: ACT-90
title: the board reissues an archived card's id to a new card
status: To Do
assignee: []
created_date: '2026-09-06 13:04'
updated_date: '2026-09-06 13:04'
labels: []
dependencies: []
type: bug
ordinal: 86008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creating a card after one has been archived assigns an id no archived card holds (observed: ACT-89 was issued twice on 2026-09-06, to an archived bun-pin card and to a live checks bug)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found 2026-09-06 by the reflect session on ACT-89, then confirmed directly against the repository.

The archived card is backlog/archive/tasks/act-89 - run-the-checks-through-the-pinned-toolchain-instead-of-asking-sessions-to-remember.md, archived in commit c6e2dba. The live card ACT-89 (session checks count the transcript prefix as behavior under test) was created hours later the same day and took the same number.

So the id counter is derived from the active tasks directory and does not account for archive/. Any archive frees its number for reuse, which means this recurs on every archive rather than being a one-off.

Cost: an id is how a card is referenced in commits, notes and conversation. Two cards sharing one makes the history ambiguous. Searching the log for act-89 today returns commits from both. The damage grows with the archive, since older references are the ones most likely to be read by someone who was not there.

Not urgent: nothing is currently broken by it beyond ambiguous references, and both ACT-89s are resolved. Worth fixing before the archive grows.
<!-- SECTION:NOTES:END -->
