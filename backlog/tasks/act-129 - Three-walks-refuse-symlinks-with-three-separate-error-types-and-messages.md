---
id: ACT-129
title: Three walks refuse symlinks with three separate error types and messages
status: To Do
assignee: []
created_date: '2026-09-08 22:34'
updated_date: '2026-09-08 23:15'
labels: []
dependencies:
  - ACT-128
  - ACT-132
priority: medium
ordinal: 125008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a fixture tree, a corpus entry, and a hashed directory tree each holding a symlink are refused with one error type, and a caller that translates the refusal names one type rather than three (observed by reading the three call sites: session-attempt.ts seedFixture, session-corpus.ts refuseSymlinks, checkpoint.ts hashDirectory)
- [ ] #2 the refusal message for each of the three names the offending entry's path relative to the tree that was walked
- [ ] #3 bun run test, bun run lint, bun run typecheck all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Exposed by ACT-113 (commit 438145a), which added the third. The three now are:

- session-attempt.ts seedFixture, throws SessionInputError, message 'Fixture entry <p> is a
  symlink, which would lead out of the attempt directory'
- session-corpus.ts refuseSymlinks, throws SessionCorpusError, message 'Corpus entry <p> is
  a symlink, which would snapshot bytes from outside the corpus source'
- checkpoint.ts hashDirectory, throws SymlinkedEntryError, message 'Entry <p> under <root>
  is a symlink, which would hash bytes from outside the walked tree'

One policy, three encodings. The cost already incurred: session-run-command.ts now has two
separate catch blocks translating two of the three into RefusedPreconditionError, and the
fixture tree is walked by two of them in sequence, so which message a case author sees
depends on which walk runs first rather than on anything they can see.

Not folded into ACT-113: unifying them is not behavior-preserving (it changes three
message strings and at least one error type crossing a module boundary), so the
after-task pass files it rather than doing it.

Note the messages are also each other's precedent: ACT-128 records that session-corpus's
stated reason is factually wrong, and ACT-113's shaping cited that same wrong reason as
precedent. Settle ACT-128 before or with this.

Triage 2026-09-09: dependencies set to ACT-128 and ACT-132, per doc-49's proposed order (ACT-132 first, then ACT-130, then ACT-129, then ACT-128). Reason doc-49 gives for putting ACT-129 after the fixes: unifying three error types before the last caller lands means redoing it, and ACT-132 would add a fourth refusal site. ACT-128 is a dependency because this card's own notes say 'Settle ACT-128 before or with this' (session-corpus's stated reason is the precedent one of these three messages rests on).

Premise verified 2026-09-09: all three error types and all three message strings are as this card records them, read at session-attempt.ts seedFixture, session-corpus.ts refuseSymlinks, and checkpoint.ts hashDirectory. session-run-command.ts's two catch blocks confirmed.
<!-- SECTION:NOTES:END -->
