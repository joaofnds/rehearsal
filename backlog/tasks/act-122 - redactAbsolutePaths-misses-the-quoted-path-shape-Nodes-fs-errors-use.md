---
id: ACT-122
title: redactAbsolutePaths misses the quoted path shape Node's fs errors use
status: To Do
assignee: []
created_date: '2026-09-08 16:09'
updated_date: '2026-09-09 13:04'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-56 - triage-2026-09-09-c.md
priority: high
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

Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set High this run, from unprioritized.

Reproduced by triage this run rather than ranked on the card's claim. Passing a real Node fs error string through redactAbsolutePaths:

  input : ENOENT: no such file or directory, open '/Users/joaofnds/code/rehearsal/secret.md'
  output: unchanged, the absolute path intact

The same call redacts 'failed at /Users/.../x.md' to '<path>' and correctly leaves 'agents/escape.md added' alone, so AC#2's protection works and only the quoted shape leaks.

Cause, read this run: ABSOLUTE_PATH in src/server/redact-path.ts is /(?<=^|[\s(])\/[^\s,)]*/gu. The lookbehind admits start-of-string, whitespace or an opening paren. Node's fs errors write the path after an opening single quote, which is none of those, so the redactor never fires on the exact message shape the server most often forwards.

High, and the reason is that this is a live information leak rather than a cosmetic defect. run-history.ts line 228 passes a failure reason through this redactor into a response a browser reads, and the operator's home directory is what leaks. It is on a shipped surface today, needs no unusual input to trigger, and the module's own comment states the property it fails to hold.

Small and self-contained: the fix is the lookbehind, and AC#2 already names the regression to guard.

Triage note, 2026-09-09 (doc-56): the script will not pick this card, despite it being the ready queue's first line. Its line carries two tags, '[HIGH] [bug]', which is exactly the defect ACT-136 describes, so iterate's picker falls through to ACT-136. Verified this run by running the picker's own regex against the live listing: true first line ACT-122, picker returns ACT-136.

The priority is not being lowered to resolve that. High is what the consequence scale gives a live leak of the operator's home directory to a browser, and bending a field to steer a broken picker would put a false value on the card. ACT-136 running first is the correct outcome on its own merits and it repairs the picker, after which this card is reachable.
<!-- SECTION:NOTES:END -->
