---
id: ACT-133
title: >-
  A hardlinked corpus file hands the harness bytes from outside the root, which
  containment cannot see
status: To Do
assignee: []
created_date: '2026-09-08 23:49'
updated_date: '2026-09-09 10:31'
labels: []
dependencies: []
priority: low
ordinal: 129008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a directory corpus source whose CLAUDE.md is a hardlink to a file outside the root does not report, hash, or install that file's bytes (reproduced 2026-09-09 at 7af4465: readCorpusInstructions on such a root returned the outside file's text 'HARDLINK SECRET')
- [ ] #2 a directory corpus source holding only ordinary files reports and hashes exactly as it does at 7af4465
- [ ] #3 bun run test, bun run lint, bun run typecheck all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the security, architecture, and spec reviewers on ACT-132 and reproduced
directly by the iterating session at 7af4465.

ACT-132's guard is containment of the fully resolved path. A hardlink resolves
to a path inside the root, because it is a second directory entry for the same
inode rather than a reference to another path, so realpath reports it as
contained and the bytes are read. No path-based check can see this; ACT-132's
mechanism is as strong as a path-based guard can be, and closing this needs a
different one, most likely comparing st_dev/st_ino or refusing an entry whose
link count exceeds one.

Reproduction at 7af4465: a corpus root whose CLAUDE.md is 'ln' (not 'ln -s') to
an outside file. readCorpusInstructions({kind:'directory',root}) returned
'HARDLINK SECRET\n', the outside file's text.

Weigh the cost before building: refusing every multiply-linked file would refuse
a corpus that legitimately hardlinks within itself, and a case corpus arrives as
data an author controls, so the threat is a case author rather than a remote
attacker. Whether this is worth closing at all is the first question the card
should answer.

Triage 2026-09-09: priority Low, and it stays a card rather than being archived.

Its own notes ask the right first question, whether this is worth closing at all. Triage's answer is that it is worth keeping open and not worth scheduling, for three reasons taken together: no path-based guard can see a hardlink, so closing it means a different mechanism (st_dev/st_ino comparison or refusing link counts above one); refusing every multiply-linked file would refuse a legitimate corpus that hardlinks within itself; and the threat is a case author against their own measurement rather than an attacker.

What would raise it: a corpus arriving from outside the operator's control, or a recorded result whose corpus digest is disputed. Neither exists today. Reconsider when a case corpus is accepted from a third party.

Ranked below ACT-134, which is the same class of hole but closable by the guard the project already has.
<!-- SECTION:NOTES:END -->
