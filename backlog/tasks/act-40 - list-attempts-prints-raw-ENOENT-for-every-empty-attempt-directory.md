---
id: ACT-40
title: list attempts prints raw ENOENT for every empty attempt directory
status: To Do
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-05 22:39'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 42008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`rehearsal list attempts` prints a raw filesystem error line for each attempt directory that holds no attempt.json, instead of skipping it or naming it as an incomplete attempt.

Observed 2026-09-04 at 540ba9a on this checkout: the command prints five ENOENT lines, three under brief-reply-40878d26, one under smoke, one under zz-symlink-probe, mixed in with the records it did read. Reproduce with `./rehearsal.ts list attempts`.

The directories are litter from attempts that failed before ACT-33's fix stopped the CLI creating a record directory ahead of the refusal. ACT-33 stopped new ones appearing; it did not make the lister tolerate the ones already there, and any future crash mid-attempt recreates the condition.

Every other lister already treats an absent thing as nothing recorded (run-layout.ts's `entries` catches and returns []). This is the same rule ACT-30 applies to a missing runs directory, one level down, and the same class of defect: a raw filesystem error reaching the operator as if it were the answer.

Found during triage on 2026-09-04 while confirming the board had no recorded runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal list attempts` on a checkout holding an attempt directory with no attempt.json prints no raw ENOENT
- [ ] #2 An attempt directory with no record is either omitted or reported as an incomplete attempt, and which one is chosen is stated on this card with its reason
- [ ] #3 A record that exists but cannot be parsed is still reported as unreadable, so this change does not hide a real failure
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, assigned to m-4. Filed as a CLI defect, but the design settles how this must behave: SPEC.md requires an unreadable record to appear in place with its reason rather than as an error, and ACT-50's acceptance carries the same rule. Fixing it in the shared read path (listRecords) fixes both surfaces at once, which is the argument for doing it with the UI rather than before it.

Decision (João, 2026-09-06): an attempt directory with no record is reported as an incomplete attempt, not omitted. Reason: a crashed attempt must stay visible to whoever is diagnosing the crash, and the run lister one function above already prints 'no record' rather than hiding the run. Asked 'incomplete reported or dropped?', João answered 'agree' to the recommendation to report. This settles acceptance criterion #2.

Observed 2026-09-06 on this checkout: six attempt directories hold no attempt.json, not the five the card records. Three under brief-reply-40878d26, one under smoke, two under zz-symlink-probe.

Note: incomplete and corrupt records both land in the unreadable block, told apart by the reason text. That satisfies criterion #3 as long as the incomplete reason is a plain sentence and not a raw filesystem message.
<!-- SECTION:NOTES:END -->
