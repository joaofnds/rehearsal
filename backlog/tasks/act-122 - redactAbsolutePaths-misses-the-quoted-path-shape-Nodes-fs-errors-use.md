---
id: ACT-122
title: redactAbsolutePaths misses the quoted path shape Node's fs errors use
status: To Do
assignee: []
created_date: '2026-09-08 16:09'
updated_date: '2026-09-08 16:09'
labels: []
dependencies: []
type: bug
ordinal: 118008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A message carrying a single-quoted absolute path is redacted, observed by passing a real Node fs error (ENOENT open '/abs/path') through the redactor and finding no home directory in the output
- [ ] #2 A relative record id or corpus path containing a slash is still left intact, observed on the cases the current word-boundary anchor was written to protect
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed 2026-09-08 in the iterate session overseeing ACT-51's review, which surfaced this as out of scope for that card.

Reproduced directly:

  redactAbsolutePaths("ENOENT: no such file or directory, open '/Users/joaofnds/secret/x.json'")
  => unchanged, home directory intact

  redactAbsolutePaths("failed at /Users/joaofnds/secret/x.json")
  => "failed at <path>"

Cause: ABSOLUTE_PATH in src/server/redact-path.ts:5 is /(?<=^|[\s(])\/[^\s,)]*/gu. The lookbehind admits only start-of-string, whitespace, or an opening paren, so a path opening with a single quote never matches. Node's fs errors quote the path exactly that way, which makes the unredacted case the common one rather than the exotic one: the errors most likely to reach a browser are the ones this misses.

Why the anchor exists, so a fix does not simply widen it away: the comment above it says it protects a relative record id or corpus path that merely contains a slash, such as checkpoint:.../shape or skills/build/SKILL.md. Any fix must keep those intact, which is what the second criterion pins.

Not blocking ACT-51. That card's SSE route now calls the redactor (commit 2b9af4c), so it is strictly better than before; this is the redactor's own pre-existing gap.
<!-- SECTION:NOTES:END -->
