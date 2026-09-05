---
id: ACT-40
title: list attempts prints raw ENOENT for every empty attempt directory
status: Done
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-05 22:45'
labels: []
milestone: m-5
dependencies: []
documentation:
  - doc-18
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
- [x] #1 `rehearsal list attempts` on a checkout holding an attempt directory with no attempt.json prints no raw ENOENT
- [x] #2 An attempt directory with no record is either omitted or reported as an incomplete attempt, and which one is chosen is stated on this card with its reason
- [x] #3 A record that exists but cannot be parsed is still reported as unreadable, so this change does not hide a real failure
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed 2026-09-06: listAttempts's session-attempt reader now checks recordFile.exists() before parsing and throws a plain 'incomplete: no attempt.json recorded' error when absent, reusing collect's existing unreadable path (commit ae79300). Verified live with mise exec -- ./rehearsal.ts list attempts: all six ENOENT lines from the baseline now read as plain incomplete reasons, valid records unaffected. Full suite green fresh (1051 pass), typecheck and lint clean. Criterion #2's decision was already settled by João on the card. Criterion #3 holds unchanged: a corrupt-but-present record still throws its own parse-error message. The redaction test that used to exercise this path via an empty attempt directory was moved to an empty checkpoint stage directory, since the incomplete reason no longer carries a path; that move surfaced the identical raw-ENOENT defect in listCheckpoints, filed as ACT-85 (not fixed here, out of this card's scope). Nothing left open on this card.

Decision (João, 2026-09-06): report a recordless attempt directory as incomplete rather than omit it. Asked 'incomplete reported or dropped?', he answered 'agree' to the recommendation to report. Reason: a crashed attempt must stay visible to whoever is diagnosing the crash. This is what criterion #2 records as chosen.

Baseline before the fix, reproduced with `mise exec -- ./rehearsal.ts list attempts`: six raw ENOENT lines, three under brief-reply-40878d26, one under smoke, two under zz-symlink-probe. The description's count of five was wrong.

Verified after the fix by the overseeing session, independently of the build session's own claim: the same command prints six plain incomplete reasons; planting invalid JSON in one of those directories makes it report its parse error while the other five stay incomplete, so criterion #3 holds against real data and not only in a test; bun test, typecheck, lint and fmt:check all clean. The pinned bun must be supplied with `mise exec --` (ACT-84).
<!-- SECTION:NOTES:END -->
