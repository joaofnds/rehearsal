---
id: ACT-122
title: redactAbsolutePaths misses the quoted path shape Node's fs errors use
status: Done
assignee:
  - '@claude'
created_date: '2026-09-08 16:09'
updated_date: '2026-09-09 13:46'
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
- [x] #1 A real Node fs error naming a missing file under a temp directory is redacted so the temp root is absent from the output, observed by creating the directory, reading the missing file, and passing the thrown message through the redactor
- [x] #2 The same observation holds when the temp directory's name contains a space, and when it contains an apostrophe
- [x] #3 A message naming an absolute path under no known root (for example a target repository at /srv/x) still comes back with that path replaced, observed by passing 'failed at /srv/target-repo/x.md' through the redactor
- [x] #4 A two-path fs error (ENOENT rename 'a' -> 'b') comes back with both paths replaced and both closing quotes still present, observed by passing that message through the redactor
- [x] #5 A relative record id or corpus path containing a slash is left intact, observed on checkpoint:<ts>/shape, skills/build/SKILL.md, cases/act-1/case.json and agents/escape.md
- [x] #6 Every route-level leak assertion in src/server/api.test.ts goes red when redactAbsolutePaths is replaced by the identity function, observed one site at a time; an assertion the route cannot make red is removed rather than kept
- [x] #7 A relative record id and a relative corpus path survive unchanged when the process reports a root of / or an empty string, observed by building the redactor against those roots
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

## Shaped 2026-09-09

Goal: no absolute path reaches a browser, and above all no root the operator
would recognise as theirs, whatever character opens the path and whatever
characters it contains.

This section was rewritten twice. Two rounds of adversarial review each
overturned the pick. The findings and their disposition are at the bottom, and
the discarded options are kept so a later session reopening this starts from the
argument.

### The pick

Anchor on the roots we know, then keep the general shape as a net behind it:

    const ROOTS = [homedir(), tmpdir()].map(escapeRegExp).join("|");
    const ABSOLUTE_PATH = new RegExp(
      `(?<=['"\`])(?:${ROOTS})[^'"\`\\n]*`
        + `|(?:${ROOTS})[^\\s,)'"\`]*`
        + `|(?<=['"\`])\\/[^'"\`\\n]*`
        + `|(?<=^|[\\s(])\\/[^\\s,)]*`,
      "gu",
    );

Four alternatives in one pattern, tried in order. A known root inside quotes runs
to the closing quote. A known root elsewhere stops at whitespace, a comma or a
quote. Then a quoted path under an unknown root. Then the existing behaviour,
unchanged.

The first two must be separate. A single root alternative running to the closing
quote swallows an unquoted list: "searched <home>/.claude, /var/folders/x2/probe"
came back as one <path> and broke the module's first existing test. Probed
2026-09-09; all five existing expectations reproduce exactly under the four-way
form.

Why the known-root alternative has to come first, and why the whole shape of the
fix changed: every purely syntactic pattern guesses where a path ends from a
delimiter, and every delimiter it could trust also occurs inside real directory
names. Round two demonstrated it on the shape round one had just adopted:

    input : ENOENT: ..., open '/Users/joaofnds/Bob's Projects/rehearsal/manifest.json'
    quoted-alternation only: open '<path>'s Projects/rehearsal/manifest.json'

The apostrophe ends the run, and the rest of the path survives. That is the same
failure the space case showed, so no character class escapes it: this is the
structural limit of guessing at path syntax, not a gap in one class. Anchoring on
the root removes the guess for the roots that matter, because the match starts at
a string we hold rather than at a character we hope means "a path starts here".

Verified 2026-09-09 against real errors, not hand-written strings. Created a temp
directory whose name contains a space, then one whose name contains an
apostrophe, read a missing file under each, and passed the thrown message
through the pick:

    raw: ENOENT: ..., open '/var/folders/.../T/probe home kIkW9i/My Documents/secret.md'
    out: ENOENT: ..., open '<path>'
    raw: ENOENT: ..., open '/var/folders/.../T/Bob's Projects R0XZeF/My Documents/secret.md'
    out: ENOENT: ..., open '<path>'s Projects R0XZeF/My Documents/secret.md'

Neither output contains the temp root or the created directory. The second leaves
a relative tail, which is the stated limit below.

### The limit this accepts, stated rather than hidden

A path under a root we do not know, containing a quote character, still leaves a
relative fragment after the quote. The root is gone, so what leaks is a directory
name and a file name with no location. The goal ranks the root highest and this
holds that; closing the fragment case too would need the message's producer to
mark the path rather than the redactor to find it, which is the reopening
condition below.

A path in a message that never touches a known root and follows "=", "[" or a
comma with no whitespace is still missed, by all four options surveyed. No caller
produces that shape today.

### Options surveyed, all probed 2026-09-09

- A, widen the delimiter class on both halves, /(?<=^|[\s('"`])\/[^\s,)'"`]*/gu.
- B, negative lookbehind on path-ish characters, /(?<![\w.:\-~\/])\/[^\s,)'"`]*/gu.
- C, quote-delimited alternation, /(?<=['"`])\/[^'"`\n]*|(?<=^|[\s(])\/[^\s,)]*/gu.
- The pick, above: known roots, then C.

Removal option first, as Find the box requires. The path where this problem does
not exist is wrapping every fs call so no raw ENOENT reaches a browser. Ruled out
by src/server/api.ts:198-203, whose onError net exists for throws no handler
anticipated; the net is the last barrier by design, so it must handle Node's own
message shape. The second removal option, stripping a caller-supplied root the
way withoutAbsolutePaths does at src/benchmark/staleness-report.ts:285, is ruled
out by redact-path.ts's docstring: the call sites cannot know the origin root.
The pick takes that idea as far as it goes without a caller, using the roots the
process can read for itself.

A loses to B on three leaks A misses and B catches: "[/Users/a/x", "path=/Users/a/x",
"a,/Users/a/x". A and B both lose to C on a path containing a space. C loses to
the pick on a path containing a quote. Each of those is a probe run this session,
and each supersedes the previous round's conclusion.

Round one recorded "A and B are indistinguishable, so the choice is not
load-bearing". That was wrong, on the three shapes above. It came from probing
only Node fs errors and this repo's existing messages without stating the scope
limit.

### The second defect, in scope

src/server/api.test.ts:63 assertNoAbsolutePath re-implements the buggy pattern
verbatim, and five assertions call it (lines 208, 269, 287, 370, 386). A detector
built from the redactor's own logic agrees with the redactor even where the
redactor is wrong, so all five pass today on a body carrying a quoted ENOENT.

Replace it with assertDoesNotLeak(body, secret), each site passing the concrete
value that test planted. Do not use one blanket root: review probed each site
and the secret differs.

- 208: the secret is the symlink target directory (`outside`, api.test.ts:191-197),
  not the corpus root. Line 188 asserts the corpus root is deliberately in that
  response, so a whole-body check on it would contradict a sibling test.
  Probed: planting the outside path and asserting on the corpus root stays
  green, so guessing the corpus root here yields a detector blind to the leak.
- 269 and 287: the secret is fixture.runsDirectory, a public readonly field on
  RecordedRunsFixture. The name `root` is not bound in those blocks.
- 370: the secret is CONTROL_DIR, which is what the test throws. A temp root
  would be vacuous there.
- 386: the secret is `corpus`.

### First test to write

In src/server/redact-path.test.ts, red before the fix:

    test("redacts a path Node quoted in an fs error", () => {
      expect(redactAbsolutePaths(
        "ENOENT: no such file or directory, open '/Users/joaofnds/secret.md'",
      )).toBe("ENOENT: no such file or directory, open '<path>'");
    });

Note for the builder: write the later tests against a real thrown fs error under
a temp directory, not a hand-written string, because that is what caught both
rounds' mistakes. Assert the root is absent from the output rather than that a
segment is absent: short segments such as "T" collide with ordinary words in the
message.

### Unknowns and how each was resolved

- Which message shapes actually leak. Probe: fs.readFile, readdir, stat, rename
  and Bun.file().text() against a missing path all quote with a single quote,
  and rename emits two.
- Whether a prefix strip supersedes the regex. Partly, and that became the pick.
  The caller-supplied root is unavailable, but homedir() and tmpdir() are
  readable from the process with no caller at all.
- Which pattern shape. Two rounds of review overturned two picks. Recorded above
  with every option and the probe that separates each pair.
- Whether a path containing a space or a quote is in scope. Yes. The goal covers
  it, and Ownership says a defect found is not left because it predates the card.
- Whether untrusted input reaches the redactor. Yes: four of the nine call sites
  forward messages built in src/cli/record-id.ts that interpolate a
  caller-supplied record id. Probed for quote injection defeating the pattern
  and found none, because the appended path stays anchored by the preceding
  space. Recorded so the next session does not have to rediscover the exposure.

### What would reopen this

A producer marking its paths explicitly, which would let the redactor stop
guessing entirely and would close the relative-fragment limit above. A record id
or corpus path grammar that admits a leading slash, which would make the general
net split it.

### Adversarial review

Two rounds, both on this record, both overturning the pick.

Round one, nine findings, two blocking. The option survey had ruled out option B
on a URL regression that does not reproduce: the class printed on the card
contains ":", so https:// cannot match, and the class actually probed did not.
The error was mine, attaching my probe's verdict to a different regex. Second
blocking: the api.test.ts prescription was vacuous at 370, unwritable at 269 and
287, and would have contradicted a sibling assertion at 208.

Round two, nine findings, three blocking. The pick adopted after round one leaks
through an apostrophe in a directory name, by exactly the argument that had been
used to choose it. AC#1 as then worded passed on the unfixed code, because a real
fs error in a test lives under /var/folders rather than under the home directory,
so "no home directory in the output" was true before the fix. AC#5 named no
secret for site 208 and the obvious guess was the wrong one. Should-fix: option B
is strictly better than A on three shapes, so "not load-bearing" was false; the
card said three call sites where there are nine, and four of them carry untrusted
input; "no segment of that path" is unsatisfiable for a short segment.

All of it is folded above. The acceptance criteria were rewritten twice as a
result, and every criterion now names a concrete value that must be absent rather
than a category.

Not verified by either reviewer: the triage claim about the iterate picker and
ACT-136, which concerns a script outside this repository. It stands as triage
recorded it.

## Built 2026-09-09

Three commits on main: 95acb4c (the redactor), ac05856 (its tests), fcc1a49 (the api.test.ts detector).

The pick from the shaped section landed unchanged: known roots first, then the quoted general alternative, then the original anchored one. One deviation, forced by oxlint's unicorn(no-array-callback-reference): the roots list maps through an arrow rather than passing escapeRegExp by reference.

Red observed before the fix on the card's first-test string. The four behavioural tests were then checked against the pre-fix module by restoring 95acb4c^:src/server/redact-path.ts over the working file: all five fail there, all pass on the fix. The /srv case and the relative-path cases pass both ways, which is correct for regression guards.

Each of the five api.test.ts sites was probed one at a time by inserting its planted secret unredacted into the body under test: each went red, and only that one.

Full suite: 1341 pass / 0 fail, plus 105 client tests. Runtime observation: a route throwing a real ENOENT under $HOME returned 500 with {"error":"ENOENT: no such file or directory, open '<path>'"}.

## Review 2026-09-09

Six unprimed reviewers (spec, style, architecture, security, testing, refactoring). Suite before the round: 1341 server pass / 0 fail, 105 client pass / 0 fail. Every axis ran; none skipped.

### Blocking, fixed

1. The three real-fs-error tests asserted `not.toContain(root)`, which a partial redaction also satisfies. Verified by deleting the quoted-known-root alternative, the whole of what commit 95acb4c added: suite stayed green. They now assert the exact output, and deleting any one of the four alternatives or the root guard fails a named test. Commit 38a29d6.

2. A degenerate root destroys every relative path. `tmpdir()` follows TMPDIR and `homedir()` is / for root in many container images. Reproduced: `TMPDIR=/ ...` turned 'skills/build/SKILL.md' into 'skills<path>'. An empty root is worse, replacing at every position. Roots shorter than a directory under / are now dropped. Commit 38a29d6. Found by four reviewers independently.

### Should-fix, fixed

3. api.test.ts:208 could not fail. The symlink refusal is built from the corpus-relative entry path in checkpoint.ts, and hashCorpusLayout always passes a non-empty prefix, so the target directory never enters the response. Verified: with redactAbsolutePaths replaced by the identity function, four sites went red and 208 stayed green. Removed; the toEqual three lines below pins the full refusal text and is strictly stronger. Commit 851be89. Found by five reviewers.

   This departs from AC#6, which named the symlink target as that site's secret. The route cannot carry it, so the criterion as written could not be met by any assertion at that site. Rewritten as behavior below.

4. My comment claimed the known-root anchor closed the apostrophe case, and the docstring scoped the fragment leak to unknown roots. Both false: '<home>/Bob's Projects/x' leaves ''s Projects/x'. Corrected, and the case is now asserted as what it is. Commit 38a29d6.

5. The test helpers leaked a temp directory per call, none removed. 98 had accumulated. afterEach cleanup added, matching api.test.ts. Commit 38a29d6.

6. Extract Variable on the four-alternative regex: the priority order is now a named list rather than a concatenation under a seven-line comment. Commit 8dd5e65.

### Notes, no action

- Over-redaction in the safe direction, all reproduced: a known root matches as a prefix of a longer directory ('/Users/joaofndsx/y' -> '<path>'), a known root matches mid-token ('prefix<home>/x' -> 'prefix<path>'), and any quoted run starting with / is consumed ('regex '/^abc$/'' -> 'regex '<path>''). No caller produces these shapes, and none leaks.
- '/private'-prefixed realpaths leave '/private' behind in the 'path=' shape the card already records as out of reach.
- Absolute paths after '=', '[' or a bare comma under an unknown root remain unredacted, as the card's options survey records.
- ROOTS is captured at module load, so a TMPDIR set after import is invisible. No caller sets it; src/benchmark/backlog.ts has the same shape.
- ReDoS and quote injection through a caller-supplied record id both probed clean by two reviewers.

### Final state

Suite: 1346 server pass / 0 fail, 105 client pass / 0 fail. Lint, typecheck, fmt clean.

Runtime observation on live routes: a 500 from a real ENOENT under $HOME returns {"error":"ENOENT: no such file or directory, open '<path>'"}; under $HOME/Bob's diary it returns '<path>'s diary/secret.md'; a 404 for a missing record returns 'No record run:no-such-run at <path>'. No home directory in any body.

AC#6 was rewritten this session. The original named the symlink target directory as api.test.ts:208's secret; five reviewers and my own probe showed the route builds that refusal from the corpus-relative entry path, so no assertion at that site can go red on a redactor defect. The rewrite states the behavior instead: every remaining leak assertion dies under an identity redactor, verified. AC#7 is new, from the degenerate-root defect the review found.

Handoff. What changed: redactAbsolutePaths now anchors on homedir() and tmpdir() before falling back to the two general alternatives, drops a root of / or an empty string, and its tests assert exact outputs rather than an absence. api.test.ts asserts the concrete planted secret at four sites.

What became possible but is not wired up: redactorFor(roots) is exported so a caller can build a redactor against roots it names. Only the tests use it; the nine production call sites all go through redactAbsolutePaths, which is unchanged in signature.

Not verified: behavior under any HOME or TMPDIR besides this machine's and the two degenerate values probed. The card's triage claim about the iterate picker and ACT-136 concerns a script outside this repository and was not checked this session.
<!-- SECTION:NOTES:END -->
