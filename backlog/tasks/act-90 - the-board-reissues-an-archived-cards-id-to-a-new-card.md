---
id: ACT-90
title: the board reissues an archived card's id to a new card
status: To Do
assignee: []
created_date: '2026-09-06 13:04'
updated_date: '2026-09-09 10:29'
labels: []
dependencies: []
priority: low
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

Triage 2026-09-09: the cost is no longer only ambiguous references. The reissued id now BLOCKS dependency edits across the whole board. Observed this run: 'backlog task edit ACT-126 --dep ACT-50' was refused with 'Cannot verify the dependencies stay acyclic: more than one record claims ACT-52. Run backlog doctor to repair duplicate IDs first.' Every --dep on this board fails the same way until the duplicate is repaired, so triage could not record one of the orderings it found.

Second reissued pair, found this run: act-52 exists both live (build-the-design-system-before-the-first-screen) and archived (settle-the-domain-vocabulary-the-UI-and-the-harness-will-share). The card above records only the act-89 pair.

Reproducing command, per decision-1: ls backlog/tasks backlog/archive/tasks | sed 's/ - .*//' | sort | uniq -d

Not repaired here: 'backlog doctor' rewrites card ids, which changes how every commit and note referencing them reads, and that is outside triage's remit.

Full duplicate set, measured 2026-09-09 by the command above: act-52, act-53, act-89. Three reissued ids, each a live card and an archived card sharing a number.

  act-52 live: build-the-design-system-before-the-first-screen
  act-52 archived: settle-the-domain-vocabulary-the-UI-and-the-harness-will-share
  act-53 live: stand-up-the-stack-end-to-end-on-one-screen
  act-53 archived: (archive/tasks)
  act-89 live: session checks count the transcript prefix as behavior under test
  act-89 archived: run-the-checks-through-the-pinned-toolchain

Cause narrowed 2026-09-09, and it corrects the CLI's own advice. 'backlog doctor' reports 'No duplicate IDs, self-referential dependencies, or dependency cycles found' on this board, while 'backlog task edit ACT-126 --dep ACT-50' refuses in the same minute naming ACT-52. Both observed this run. So the message's instruction ('Run backlog doctor to repair duplicate IDs first') routes to a command that does not see the problem, and --fix has nothing to apply.

The refusal is not board-wide. 'backlog task edit ACT-129 --dep ACT-128 --dep ACT-132' succeeded this run. What differs: the acyclic check walks the dependency chain of the card being depended on, and ACT-50's chain reaches ACT-52 (via ACT-52 and ACT-53, both themselves reissued ids), while ACT-128 and ACT-132 have no dependencies at all. So the block hits exactly those edges whose chain contains a reissued id.

Duplicates live across backlog/tasks and backlog/archive/tasks. doctor's own help says it reads 'active and completed task files' and does not name the archive, which is consistent with it not seeing these.

This makes the card's 'not urgent' assessment stale. It is now a live block on recording board structure, and its stated repair route does not work.

Triage 2026-09-09 (second run today): the escalation recorded above is STALE. Dependency edits work again.

Re-ran the exact command the note reports as refused: 'backlog task edit ACT-126 --dep ACT-104 --dep ACT-50'. It succeeded, printing 'Updated task ACT-126'. Reverted immediately, and ACT-126 has since been archived under decision-8. So the block on recording board structure is gone, and the note above that calls this 'a live block' no longer describes the board.

What did not change: the three reissued ids are still there. Measured this run by the reproducing command, act-52, act-53 and act-89 each name a live card and an archived card. 'backlog doctor' still reports no duplicates, so its blindness to backlog/archive/tasks is unchanged and its advice still routes nowhere.

Backlog CLI version this run: 1.50.1. The board rules record the facts as checked against 1.51.0, so the earlier refusal may have come from a different CLI version rather than from board state. Not settled: I did not re-run the refusal under 1.51.0, and I did not find what changed between the two runs.

Priority left Low, as the writer set it. With the block gone the cost is back to what the card originally recorded, ambiguous references that grow with the archive, which is a real but not urgent cost. The raise doc-50 recommended is withdrawn on this evidence.
<!-- SECTION:NOTES:END -->
