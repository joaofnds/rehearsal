---
id: ACT-25
title: >-
  replay a brief-reply turn as a benchmark case and judge it against the
  accepted band
status: Review
assignee:
  - '@claude'
created_date: '2026-09-02 14:55'
updated_date: '2026-09-03 04:25'
labels: []
dependencies:
  - ACT-26.5
references:
  - 'dotfiles:DOT-18'
type: feature
ordinal: 20008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Case from dotfiles DOT-17 (2026-09-02). The brief output style hands every post-tool reply to a `brief` subagent; edits to the style, the agent, or the shared task partial need a regression check that today lives as prose in dotfiles doc-4 and throwaway scripts.

Frozen inputs: four real trunk transcripts truncated just before a reply João fired /brief on (session prefix, cut index, accepted brief length): e3dea673 873 (145 words), 02f0f204 1270 (136), 40878d26 491 (108), 92b2e8b0 1268 (76). Run: resume the truncated copy headless with `--tools "Agent,Read"` (the Agent tool refuses to spawn a subagent whose tools list resolves to nothing), the prompt "Tools other than Agent and Read are unavailable now. Write your reply to João for this turn.", the corpus snapshot under test applied to `~/.claude/output-styles/brief.md` and `~/.agents/agents/brief.md`.

Judge, deterministic from the transcript: the brief agent was dispatched in the foreground with a message carrying Request and Draft parts; the sent reply equals the agent's return or the return minus whole sentences; no em dash; no backtick symbol; every question in the reply is in the draft (the Request's own questions do not count); word count against the accepted band. Single reps swing 30 to 100 words on the same turn, so confirmation needs the outer loop.

Cost observed: about 2.3 USD per turn cold. Study record: `~/code/clean-room/brief-split/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 cases/brief-reply-92b2e8b0/case.json declares kind session with prompt "Tools are unavailable now. Write your reply to João for this turn.", tools [], corpusFiles ["output-styles/brief.md"], settings {"outputStyle":"brief"}, a transcript prefix naming sourceSession 92b2e8b0-1cac-4855-87be-ba84d5cee5b9 and cut 1268, and three checks (word-band max 154, forbidden-text over the em dash, tool-calls max 0); rehearsal case show brief-reply-92b2e8b0 --json exits 0 and prints it back through the same schema that loaded it
- [x] #2 Three more cases declare the other three turns the same way: cases/brief-reply-e3dea673 at cut 873, cases/brief-reply-02f0f204 at cut 1270, and cases/brief-reply-40878d26 at cut 491, each naming its own source session, and each of the four titles states that turn's accepted brief length (145, 136, 108, 76 words) so a reader sees it without running anything
- [x] #3 No case declares a word-band min, so a reply shorter than the one João accepted passes: a test asserts the four declarations carry max 154 and no min
- [x] #4 No case declares the backtick as forbidden text: the only forbidden string in each of the four cases is the em dash, because the live brief style states no rule about backticks and João's own accepted 76-word brief for 92b2e8b0 contains one
- [x] #5 For each of the four cases, rehearsal case capture <case> --session <prefix> --cut <n> writes .benchmark-runs/cases/<case>/<file>.jsonl holding exactly lines [0,n) of the source session file under ~/.claude/projects/-Users-joaofnds-code-trunk/, and the written prefix's last line is the attachment record that precedes the fired reply, not the assistant record at the cut
- [x] #6 rehearsal case list prints all four brief-reply cases beside smoke and audit-log, and loadCase on each returns a session case whose transcript sha256 matches the captured prefix file's digest
- [x] #7 The captured prefix bytes stay out of git: git check-ignore reports .benchmark-runs/cases/brief-reply-92b2e8b0/ ignored, git status is clean after all four captures, and the four tracked case.json files each carry file, sha256, sourceSession, and cut
- [x] #8 One debug attempt of brief-reply-92b2e8b0 exits 0 and writes an attempt record carrying a non-empty reply, the path of a transcript copy, the provider call metrics, and one result per declared check; rehearsal show on that record id prints it back
- [ ] #9 That first attempt returns prose addressed to João rather than tool use or a refusal: the record's reply is non-empty, the tool-calls check passes with zero tool_use records in the transcript copy, and the reply is not a restatement of the prompt. This is the observation that settles whether a settings overlay is honored on --resume, which ACT-26.5 left explicitly unverified
- [ ] #10 The attempt record's corpusFiles names output-styles/brief.md with the sha256 the live install has at attempt time, and rehearsal stale reports none of the four cases stale against that corpus and all four stale against a corpus directory whose brief.md differs by one byte
- [ ] #11 One debug attempt of each of the other three cases exits 0 with a non-empty reply, and the card records all four replies' word counts beside that turn's accepted length (145, 136, 108, 76) together with each word-band result
- [x] #12 No case declares a check over an agent dispatch, over a sent reply equal to an agent's return, or over questions present in a draft: a grep for those over cases/ returns nothing, because the mechanism they judged was reverted from dotfiles on 2026-09-02
- [x] #13 rehearsal run --case brief-reply-92b2e8b0 --confirm --reps 2 --yes prints the cost projection and then exits 3 saying a session confirmation group is not built, making no provider call; the card records the group observation as not made, with the card that would enable it
- [x] #14 The card records the cost of every paid call Build made and their total, and that total is at or under USD 10
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Goal

Four session cases replay the four real trunk turns that drew `/brief`, resumed
from a transcript cut at the fired reply, and judge the reply the live brief
style produces against the band João's own accepted rewrites occupied.

## The card's premise is partly false

The description was written on 2026-09-02 against dotfiles DOT-17, in which the
brief style handed every post-tool reply to a `brief` subagent. That hand-off
was reverted at João's direction the same day and erased from dotfiles history.
Verified this dispatch: `~/.agents/agents/` holds only `reviewer.md`, and
`grep -n -i "backtick|em dash|dash" ~/.claude/output-styles/brief.md` returns
one line, the em dash rule. The live style is the single file
`~/.claude/output-styles/brief.md`, 196 lines.

Three things in the description therefore have no referent and are not built:
the two agent checks, the `--tools "Agent,Read"` invocation, and the prompt
naming the Agent and Read tools. Each is recorded under "Not built, and why"
with the trigger that would revive it. What survives is the frozen inputs, the
band, the em dash, and the cost figures, all re-verified below.

## Unknowns, and how each was resolved

Every resolution cites a file or a tool result from this dispatch.

1. **Whether the four frozen inputs and their cuts are real.** Verified by
   reading each file under `~/.claude/projects/-Users-joaofnds-code-trunk/`:
   `e3dea673` 1952 lines cut 873, `02f0f204` 2154 lines cut 1270, `40878d26`
   1015 lines cut 491, `92b2e8b0` 1676 lines cut 1268. At every cut the record
   at index `cut` is type `assistant` and the record before it is type
   `attachment`, and each file's first record carries its own session id.
   Resolved: the cuts are exact and `case capture --cut n` keeps lines [0, n),
   so the prefix ends on the attachment and drops the fired reply.

2. **What the record at the cut actually is.** Read it: 294, 333, 313, and 195
   words. Those are not the accepted lengths the card names. Resolved: the
   record at the cut is the *fired* reply, the long one João then answered with
   `/brief`. The accepted rewrite is a later assistant record in the same file,
   after the `/brief` user record. Read at indices 881, 1282, 499, and 1276,
   they count 145, 136, 108, and 76 words, matching the card exactly. The
   glossary term "Fired reply" was added because the card's phrase "truncated
   just before a reply João fired /brief on" describes this and nothing named
   it.

3. **What the accepted band is, and whether it is a floor.** Read dotfiles
   `doc-4` lines 28 and 209: the accepted rewrites ran 51 to 154 across the
   population and 108 to 145 on these four turns. The direction settles
   `word-band { max: 154 }`. Resolved: the ceiling is the check, and there is
   no floor, because a reply shorter than the one he accepted is not a failure.
   The per-turn accepted length goes in each case's title, where a reader sees
   it without running anything.

4. **Whether the backtick belongs in `forbidden-text`.** It does not, and this
   is the one place the shaping departs from the direction. Three observations:
   (a) the live style states "Never an em dash" by name and states no rule
   about backticks at all; (b) `~/.claude/skills/brief/SKILL.md` states none
   either; (c) João's own accepted 76-word brief for `92b2e8b0` contains
   `` `./build` ``. doc-1 line 50 attributes the backtick check to the
   clean-room brief-split study, which measured the reverted agent's return,
   not the style's reply. A check that fails the reply João kept measures the
   check, not the corpus. Resolved: `forbidden-text` declares the em dash
   alone. See "Decided autonomously" 1 and "Not built, and why".

5. **Whether `run --confirm` on a session case produces a group report.** Read
   `src/cli/run-command.ts:396-401`: `runConfirmed` rejects with
   `RefusedPreconditionError("A session confirmation group is not built yet;
   run the case without --confirm")`. ACT-26.5's handoff says the same.
   Resolved: the group observation the dispatch asked Build to make cannot be
   made. Build runs the command anyway to record the refusal as evidence, and
   the acceptance criterion states the refusal rather than a group report.

6. **Whether a case's `settings` overlay survives to the provider.** Read
   `src/benchmark/session-attempt.ts:90-101` and `session-corpus.ts:226-235`:
   with no `--corpus` there is no overlay, `styleName` is `undefined`, and the
   case's own `settings` JSON is passed through verbatim as `--settings`. With
   `--corpus` the snapshot's style name replaces `outputStyle` so the variant
   shadows the live file. Both paths carry the case's declaration. Resolved:
   `settings: {"outputStyle": "brief"}` is the right declaration and needs no
   harness change. Whether the provider *honors* it on `--resume` is the one
   thing still unverified in this harness; dotfiles doc-4 line 64 records that
   it does, and Build's first attempt is the re-check.

7. **Whether the three check kinds exist with the fields the direction names.**
   Read `session-check-word-band.ts`, `session-check-forbidden-text.ts`, and
   `session-check-tool-calls.ts`: `word-band` takes optional `min` and `max`
   and requires at least one, `forbidden-text` takes a non-empty `strings`
   array, `tool-calls` takes optional `min`, `max`, and `names`. Resolved: the
   declarations need no new check kind and no harness change. This card is
   data plus one paid observation.

8. **Whether the case ids are legal.** Read `case.ts:21-26`: a case id is
   lowercase letters, digits, and dashes. `brief-reply-92b2e8b0` matches.

9. **Whether the transcript bytes stay out of git.** Read `.gitignore`: it
   holds `.benchmark-runs/`, and `case capture` writes prefixes under
   `.benchmark-runs/cases/<case>/`. Resolved: nothing to change; the
   declarations carry the digest, the source session, and the cut.

10. **The baseline the work starts from.** Ran all four gates this dispatch on
    the working tree: `bun run typecheck` 0, `bun run lint` 0,
    `bun run fmt:check` 0, `bun test` 995 pass 0 fail. The dispatch's warning
    about five pre-existing failures describes a fresh clone; this tree is
    green, so any failure Build sees is its own.

## Decided autonomously

Nobody answers questions in this run. Each follows the dispatch's decision
policy in its stated order and can be reversed by João.

1. **`forbidden-text` declares the em dash alone, not the backtick.** Reason:
   the shape skill's rule that a constraint backed by a stated reason rather
   than a measurement is the claim to test, and here the measurement exists and
   falsifies it. João's accepted brief for `92b2e8b0` contains a backtick, and
   no file in the live corpus forbids one. Declaring it would make three of the
   four cases pass a rule the corpus does not state and make the fourth fail
   against João's own kept reply, so every later session would tune the style
   toward a rule he never wrote. This is the only departure from the dispatch's
   settled list, and it is backed by a direct observation rather than a
   prediction. Reversal is one string in four files.

2. **The accepted length lives in each case's title, not in a check.** Reason:
   the direction settles that it is not a check. A title is what
   `rehearsal case list` prints, so the reader sees 76 beside the band without
   opening the declaration.

3. **No `min` on the word band.** Reason: same as above, stated as a design
   consequence rather than left implicit. A `word-band` may declare only `max`
   (the schema's refine allows it), so the declaration says exactly what is
   being judged.

4. **Four separate cases rather than one case with four transcripts.** Reason:
   doctrine section 1 and the harness's own shape. A benchmark case is the unit
   comparison arms pair on, and a case declares exactly one transcript prefix.
   Four turns are four independent measurements of the same corpus, which is
   what a confirmation group over them will eventually average.

5. **`tool-calls { max: 0 }` is declared even though `tools: []` should make it
   impossible.** Reason: it is the check that catches the failure mode the
   dispatch warns about, a resumed session that resumes tool use instead of
   replying. Without it, such an attempt would record an empty or truncated
   reply and a passing band. Cheap, and it fails informatively.

6. **The prompt is doc-4's exact wording, "Tools are unavailable now. Write
   your reply to João for this turn."** Reason: the direction settles it and
   doc-4 line 57 records it verbatim. A bare "continue" made the resumed
   session resume tool use rather than reply.

7. **Build records the `--confirm` refusal as an observation rather than
   skipping it.** Reason: the dispatch asked for a group report that unknown 5
   shows cannot exist. Running the command and recording exit 3 turns a
   promised deliverable into a measured fact, and it also confirms the cost
   projection prints before the refusal.

## Not built, and why

Each is named by the card, doc-1, or the direction, and no declared case needs
it. The trigger that would build it is named.

- **The check "the brief agent was dispatched in the foreground with Request
  and Draft parts" and the check "the sent reply equals the agent's return or
  the return minus whole sentences".** The mechanism was reverted from dotfiles
  on 2026-09-02 and `~/.agents/agents/` holds only `reviewer.md`. A check with
  no referent cannot fail informatively and would freeze a corpus shape João
  removed. Trigger: a corpus in which a style hands a reply to an agent again.

- **The check "every question in the reply is present in the draft".** Same
  trigger. There is no draft without the hand-off.

- **A `forbidden-text` string for the backtick.** Unknown 4 and decision 1: the
  live corpus states no such rule and João's own accepted reply for one of the
  four turns contains one. Trigger: the style gaining a rule about symbols or
  code in replies, at which point the string is added to all four cases at
  once.

- **A control arm for the style.** One declaration away: the same four cases
  against a minimal corpus. Trigger: the first style edit João wants compared,
  which is when a control has something to be a control for.

- **A session confirmation group.** Not built in the harness (unknown 5), so
  the reliability summary these four cases exist to feed does not exist yet.
  Trigger: the card that builds it. Until then each case yields single debug
  attempts, and doc-4's warning that single reps swing 30 to 100 words on one
  turn means no single attempt is a verdict on the style.

- **A `min` on the word band, and a check on the fired reply's own length.**
  Nothing measures either. Trigger: evidence that a too-short reply drops
  something João acts on.

## Implementation plan

This card writes almost no code: the harness ACT-26.5 shipped already has every
check kind, the capture verb, and the session attempt. The work is four
declarations, four captures, and one paid observation, ordered so nothing is
paid for before the free checks pass.

1. **Capture the cheapest turn.** Create `cases/brief-reply-92b2e8b0/case.json`
   with the declaration below, then
   `rehearsal case capture brief-reply-92b2e8b0 --session 92b2e8b0 --cut 1268`.
   Verify the written prefix is 1268 lines and its last line is the attachment
   record. Free.

2. **Capture the other three.** Same, at cuts 873, 1270, and 491. Verify each
   the same way, and verify `git status` shows only the four `case.json` files.
   Free.

3. **The first paid attempt.** `rehearsal run --case brief-reply-92b2e8b0
   --model opus --effort high --session-budget-usd 3 --json`. This is the
   observation that settles unknown 6. If the reply comes back as tool use or
   as a refusal, stop and record it: do not retune the prompt. Expect about
   USD 2.3 cold.

4. **The other three attempts.** Same invocation per case, warm cache expected.
   Record each reply's word count beside its accepted length.

5. **The refusal.** `rehearsal run --case brief-reply-92b2e8b0 --confirm
   --reps 2 --yes`, recording the projection and exit 3. Free.

6. **Staleness.** `rehearsal stale` before and after a byte change to a copy of
   the style, to observe the four cases going stale on the corpus file they
   declare. Free if done against a corpus directory rather than by editing the
   live install, which this card must not touch.

The declaration for the cheapest turn, which the other three follow:

    {
      "id": "brief-reply-92b2e8b0",
      "kind": "session",
      "title": "Trunk turn on a Python build script; the brief he accepted ran 76 words",
      "prompt": "Tools are unavailable now. Write your reply to João for this turn.",
      "tools": [],
      "settings": { "outputStyle": "brief" },
      "corpusFiles": ["output-styles/brief.md"],
      "checks": [
        { "kind": "word-band", "max": 154 },
        { "kind": "forbidden-text", "strings": ["—"] },
        { "kind": "tool-calls", "max": 0 }
      ]
    }

`transcript` is absent above because `case capture` writes it.

## First test to write

The cases are data, so the first test is a characterization of the data, in
`src/benchmark/case.test.ts` beside the smoke and audit-log assertions:

> `loadCase("brief-reply-92b2e8b0")` returns a session case whose transcript
> names source session `92b2e8b0-1cac-4855-87be-ba84d5cee5b9` at cut 1268 and
> whose checks are the word band at 154, the em dash, and no tool calls

Arrange nothing but the repository; act by calling
`loadCase("brief-reply-92b2e8b0")`; assert the loaded value's `kind` is
`"session"`, its `transcript.sourceSession` and `transcript.cut`, its
`settings`, its `corpusFiles`, and its three checks. It fails now because the
case directory does not exist. It is the smallest thing that forces the
declaration into existence with the digest the capture wrote, and it is the
assertion every later step leans on, because a wrong cut is invisible until a
paid attempt replies to the wrong turn.

The second test is the same over the other three cases, table-driven on
(case id, source session, cut, accepted words), which is where a transposed cut
would show up.

---

## Build handoff

### What changed

Four session cases, one per trunk turn that drew `/brief`, each declaring the
prompt, `tools: []`, `settings: {"outputStyle": "brief"}`,
`corpusFiles: ["output-styles/brief.md"]`, the transcript prefix its capture
wrote, and three checks (`word-band {max: 154}`, `forbidden-text` over the em
dash alone, `tool-calls {max: 0}`). Each title states that turn's accepted
length, so `case list` shows 145, 136, 108, and 76 without opening a file. The
prefix bytes stay git-ignored under `.benchmark-runs/cases/`; only the
declarations with their digests are committed.

One defect fix and one test refactor came with it, each in its own commit.

### The finding: the first paid attempt

**The reply is not in the brief style's shape, and the harness cannot yet
report whether the resumed session made a tool call.**

One paid call, `brief-reply-92b2e8b0`, USD 2.456045, exit 0, record at
`attempt:session:brief-reply-92b2e8b0/39c3f302-da90-4480-8e52-aa8f5c4f9638`.

What behaved. The declared prompt reached the session verbatim (the transcript's
`last-prompt` record carries it). The reply is prose addressed to João on this
turn's own subject, the Python build script, so `--resume` over the forked
prefix put the session on the right turn with the right context. It is not a
refusal, not tool use, and not a restatement of the prompt. `forbidden-text`
passed: no em dash.

What did not. The reply runs 196 words against the 76 João accepted, and its
recommendation ("My recommendation is to leave it") sits in the fourth of five
paragraphs. The live style's two most emphasized rules are "Put the conclusion
first" and "Length is what is left after you cut what he can't act on". Against
those, this is not brief-style output. It also names `./build` and
`./build --list`, which the style's "Keep file names, symbols, and code out of
the reply" forbids, though João's own accepted reply for this turn does the
same, so that clause is weak evidence either way.

**On the settings overlay, which ACT-26.5 left unverified: still unsettled, and
the transcript cannot settle it.** `sessionCaseArgs` did pass
`--settings '{"outputStyle":"brief"}'` (read at `session-attempt.ts:105-135`).
The written transcript names no output style anywhere, in the prefix or in the
records the attempt appended, so nothing in the record says whether the provider
applied it. The only evidence is the reply's shape, and the reply's shape says
it probably did not. That is a finding, not a proof: a resumed session inherits
its own history, and 195 words of fired reply sit at the end of that prefix, so
an un-styled reply and a styled reply anchored on the fired one are not
distinguishable from one sample. What would settle it cheaply is a control:
the same case with `settings` removed, one attempt, compared. That is one
declaration and one call, and it is the next thing worth paying for.

Per the dispatch's instruction, the prompt was not retuned and the remaining
three turns were not run.

### The harness defect this exposed: ACT-32

`tool-calls {max: 0}` failed with "211 tool calls, more than 0" while the
attempt made none. `session-attempt.ts:284` evaluates transcript-reading checks
over the whole forked file, so all 211 `tool_use` records inside the 1268-line
prefix the case deliberately resumes count against the attempt. Verified:
`tail -n +1269` over the transcript copy yields two assistant records, two user
records, and no `tool_use` at all.

Any session case with a transcript prefix therefore fails `tool-calls {max: 0}`
by construction, and the check cannot express the failure mode it exists to
catch. The case declares its `cut`, so the fix has the information it needs, but
it changes what a check kind measures, which is a design decision rather than a
data edit. Filed as **ACT-32** with three acceptance criteria rather than made
here, per the dispatch's instruction to stop on harness code.

Until ACT-32 lands, the `tool-calls` FAIL on these four cases is evidence about
the check, not about the corpus.

### Defect fixed on the way

`case capture` rewrote the committed `case.json` with a two-space indent, which
the repository's own formatter rejects, so every capture left `fmt:check`
failing on a tracked file. The smoke case has never carried a transcript, so
nothing had exercised the write path against the formatter. Fixed in
`5788328`: the committed file takes a tab indent, the `--json` output keeps the
two-space form it shares with every other record printer. `JSON.stringify`
still cannot reproduce oxfmt's collapsing of short arrays onto one line, so a
capture is followed by `bun run fmt`, which is the same workflow every other
file has. Making the command shell out to a dev-time formatter would have been
worse than that residue.

### What was observed, and how

- The four frozen inputs, before capturing anything: line counts 1952, 2154,
  1015, 1676; each file's first record carries its own session id; at each of
  the cuts 873, 1270, 491, 1268 the record at the cut is `assistant` and the one
  before it is `attachment`.
- The accepted replies at indices 881, 1282, 499, 1276 count 145, 136, 108, and
  76 words, and the 76-word one contains `` `./build` ``.
- The live style has exactly one forbidden-symbol rule, for the em dash
  (`brief.md:91`), and states nothing about backticks. `~/.agents/agents/` holds
  only `reviewer.md`.
- Each captured prefix is byte-identical to its source's lines [0, cut):
  `cmp` against `head -n <cut>` for all four. Each ends on the attachment
  record and matches the sha256 its declaration carries.
- `git check-ignore` reports the prefix directory ignored; `git status` is clean.
- `case list` prints all four beside smoke and audit-log with the accepted
  lengths in the titles; `case show brief-reply-92b2e8b0 --json` exits 0.
- `run --case brief-reply-92b2e8b0 --confirm --reps 2 --yes --model opus
  --effort high --session-budget-usd 3` printed
  "Projected maximum cost: $6.00 (2 reps x $3.00)" and then exited 3 with
  "A session confirmation group is not built yet; run the case without
  --confirm". No attempt record was written, so no provider call was made.
- `stale` against the live install reports only `case:smoke`; against a corpus
  directory whose `brief.md` differs by one appended byte it reports
  `case:brief-reply-92b2e8b0` as well.
- Gates on the final tree: `bun run typecheck` 0, `bun run lint` 0,
  `bun run fmt:check` 0, `bun test` 0 with 1005 pass and 0 fail.

### What was not verified

- **Whether the provider honors the settings overlay on `--resume`.** Attempted;
  the evidence is one reply's shape and it points at "no". Not proven either
  way. The control attempt described above is what would settle it.
- **The other three turns.** No attempt was made on `e3dea673`, `02f0f204`, or
  `40878d26`, so their replies have no word counts and their `word-band`
  results do not exist. Projected cost had they run: about USD 0.45 warm or
  USD 7 cold, against USD 7.54 remaining under the cap.
- **Staleness across all four cases.** Only `brief-reply-92b2e8b0` has an
  attempt, and a case with no attempt is not stale, so the other three appear
  in neither the fresh nor the stale listing. The mechanism is observed on the
  one case that has evidence.
- **A confirmation group over these cases.** Not built in the harness; the
  refusal is the observation.
- Nothing here says whether the four cases discriminate between two corpus
  variants. That needs the control arm and a confirmation group.

### Word counts against the accepted lengths

| case | accepted | attempt | word-band (max 154) |
|---|---|---|---|
| brief-reply-e3dea673 | 145 | not run | not evaluated |
| brief-reply-02f0f204 | 136 | not run | not evaluated |
| brief-reply-40878d26 | 108 | not run | not evaluated |
| brief-reply-92b2e8b0 | 76 | 196 | FAIL, 196 outside at most 154 |

### Paid calls

| call | cost |
|---|---|
| debug attempt, brief-reply-92b2e8b0, opus/high | USD 2.456045 |
| **total** | **USD 2.456045** |

Under the USD 10.00 cap. Three attempts were skipped deliberately, not for
budget: the first attempt hit the dispatch's stop condition.

### Decided autonomously

Nobody answers questions in this run. Each follows the dispatch's decision
policy and can be reversed by João.

1. **The paid observations stopped after the first attempt.** The dispatch said
   to stop and record if the reply came back "plainly not in the brief style".
   It came back as prose on the right turn, so not a refusal and not tool use,
   but at 196 words with its recommendation in the fourth paragraph it violates
   the style's two most emphasized rules. Three more attempts at about USD 7
   would have measured the same unsettled configuration four times instead of
   once. The finding is worth more than the repetition, which is the dispatch's
   own judgment.

2. **The `tool-calls` defect was filed, not fixed.** The dispatch said to stop
   if I found myself writing harness code. Correcting the check means deciding
   what a transcript-reading check measures for a resumed case, which is a
   design decision with its own acceptance criteria. ACT-32 carries the
   evidence and the likely shape.

3. **The `case capture` indent defect was fixed here rather than filed.** It is
   small, reversible, and directly in this card's path: without it every
   capture this card made left `fmt:check` red, and the column cannot end with
   a failing gate. Its own commit, revertible alone.

4. **Titles name the turn's subject as well as its accepted length.** The card
   requires the length; the subject is what makes four otherwise identical
   entries in `case list` tell each other apart.

5. **No shared template across the four declarations.** They repeat everything
   but id, title, and transcript, which is real duplication, but no templating
   exists in the schema and a case must stand alone to be the unit a comparison
   pairs on. Building one for four cases is speculative generality. Trigger: a
   fifth turn, or a variant set that would multiply them.

6. **`expect.stringContaining` was replaced with `toContain`.** It returns
   `any` and tripped `no-unsafe-assignment` under the type-aware lint. A
   suppression would have been the exception the style skill forbids.

### Refactor pass

The structural opportunity the task exposed is the one ACT-32 records: the
check-evidence boundary does not distinguish the history a case resumes from
the records its attempt produced, so `CheckEvidence` carries a claim it cannot
support. Filed rather than done, because it changes a check kind's meaning.

Done in the tree: the brief-reply test table's columns are named, so a
transposed cut and accepted-word count can no longer read as a passing test
against the wrong turn.

Not done, with reasons: the four declarations' duplication (decision 5 above);
`serialize` and `serializeCommitted` in `case-command.ts`, which look alike but
encode two different requirements, so DRY does not join them.

### Review

Independent review is due. The card carries a paid observation whose
interpretation is a judgment call, one deliberately unfixed harness defect, and
a departure from the direction on the backtick that Shape recorded and Build
did not revisit.
<!-- SECTION:NOTES:END -->
