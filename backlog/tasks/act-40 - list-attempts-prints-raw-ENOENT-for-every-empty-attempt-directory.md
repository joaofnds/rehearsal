---
id: ACT-40
title: list attempts prints raw ENOENT for every empty attempt directory
status: Build
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-05 22:40'
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
Shaped 2026-09-06. Goal: an attempt directory with no attempt.json is reported as an incomplete attempt through the existing unreadable-record path, not a raw ENOENT.

Root cause, found by reading src/cli/list-command.ts: listAttempts's session-attempt reader (around line 256) calls Bun.file(recordFile).text() with no existence check, so a missing attempt.json throws a raw ENOENT that collect's catch block reports verbatim. listRuns one function above (line 125) already has the fix pattern: it checks Bun.file(paths.artifactFile).exists() first and returns a plain field ('no record') instead of letting the read throw. Same file, same collect() mechanism, same fix shape.

Approach: in listAttempts's session branch, check recordFile existence before parsing; when absent, throw a plain Error (e.g. 'incomplete: no attempt.json recorded') instead of returning a field directly. Routing it through a throw (not a returned field) keeps it in the unreadable list per João's decision below, and keeps it visually distinct from a parsed 'no record' run line, while still reusing collect's existing catch/unreadable plumbing. A parse failure on an existing-but-corrupt file still throws its own message unchanged, so criterion #3 holds: incomplete and corrupt both land in unreadable, told apart by reason text.

Acceptance criterion #2 is already settled on this card (João, 2026-09-06): report as incomplete, do not omit.

First test to write: a listAttempts (or runList) test with an attempt directory holding no attempt.json, asserting the unreadable entry's reason is the plain incomplete sentence, not a message containing ENOENT.

No open unknowns. Ready for build.

Decision (João, 2026-09-06): an attempt directory with no record is reported as an incomplete attempt, not omitted. Asked 'incomplete reported or dropped?', he answered 'agree' to the recommendation to report. Reason: a crashed attempt must stay visible to whoever is diagnosing the crash. This settles acceptance criterion #2.

Baseline reproduced 2026-09-06 with `mise exec -- ./rehearsal.ts list attempts`. The pinned bun must come through mise; the shell's default 1.4.1 makes the CLI refuse to start (ACT-84). Six raw ENOENT lines print above the valid records: three under brief-reply-40878d26, one under smoke, two under zz-symlink-probe. The card's description says five, which was wrong. The fix must turn these six lines into plain incomplete-attempt reasons.
<!-- SECTION:NOTES:END -->
