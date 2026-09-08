---
id: ACT-132
title: >-
  A symlinked CLAUDE.md at the corpus root is followed, bypassing the
  directory-walk refusal
status: To Do
assignee: []
created_date: '2026-09-08 22:44'
updated_date: '2026-09-08 23:20'
labels: []
dependencies: []
priority: high
ordinal: 128008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a corpus root whose CLAUDE.md is a symlink pointing outside the root keeps the target path and bytes out of the corpus report files and digest, refused or omitted (reproduced 2026-09-09: corpusReport on a directory corpus whose CLAUDE.md linked to an outside file returned that file hashed under path CLAUDE.md)
- [ ] #2 a corpus source whose instruction file is a real file still reports it exactly as it does today
- [ ] #3 bun run test, bun run lint, bun run typecheck all pass (the project own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the security reviewer on ACT-113 and reproduced directly in that session.

src/server/corpus-report.ts:69-75 hashes the instruction file through hashFile, never
through hashDirectory, so the symlink refusal ACT-113 added does not see it. hashFile
opens the path, which follows a link.

Reproduction: a corpus root holding only CLAUDE.md -> /tmp/cm/secret.md. corpusReport
returned files ['CLAUDE.md'] with the outside file's bytes hashed under that path.

Pre-existing and in a different code path from the one ACT-113 changed. Its acceptance
criteria all name the directory walk, so this sits outside them; filed rather than folded
in, so each change stays reviewable alone.

Same shape as the root-position leak ACT-113 did close (commit 47ed48b): a link one level
above where the guard looks. Worth settling with ACT-129, which covers the three separate
symlink refusals, since a fourth site here would be a fourth encoding of one rule.

Premise verified 2026-09-09 by the iterating session, before the fix ran: a corpus root holding only CLAUDE.md -> /tmp/act132/outside/secret.md. corpusReport returned one file at path CLAUDE.md whose sha256 equals shasum of the outside file, so the outside bytes are hashed and reported under the in-root path. corpus-report.ts hashCorpusLayout hashes the instruction file via hashFile while the layout directories go via hashDirectory with its rootMayBeALink guard, so the two paths differ as the card records.
<!-- SECTION:NOTES:END -->
