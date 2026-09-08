---
id: ACT-50
title: build the comparison and corpus screens
status: Build
assignee:
  - '@claude'
created_date: '2026-09-04 13:01'
updated_date: '2026-09-08 00:56'
labels: []
milestone: m-7
dependencies:
  - ACT-47
  - ACT-48
  - ACT-49
  - ACT-52
  - ACT-53
priority: medium
ordinal: 52008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The first shippable slice of the UI: every screen whose data the harness already records. Run history, run detail, comparisons, corpus, cases, and calibration all read durable records under .benchmark-runs and declarations under cases/.

This deliberately excludes the live monitor, which needs a run in flight and has no data source today. See the live-monitor card.

Build against the committed design, not against a description of it, so this waits on the export card. It also waits on the vocabulary decision, because every label and route depends on it.

Reuse the read paths the CLI already has rather than reimplementing record reading: `listRecords(kind, runsDirectory)` in src/cli/list-command.ts returns entries plus the records it could not read, and show-command.ts maps a parsed record id to its file. Going through those means the id-traversal refusal that guards `show` guards the UI too, and a record the CLI cannot read is reported rather than crashing a listing.

Two behaviors the design gets right and the current CLI gets wrong, so the UI must not copy the CLI: a stopped run is a normal outcome and must render as one rather than an error (ACT-44 covers the CLI half), and an unreadable record is reported in place with its reason rather than as a raw ENOENT (ACT-40).

Stack: TypeScript on Bun, no framework unless the design demands one, consistent with the project's stated constraints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Comparison screen, Attempt-pairs presentation: rows are cases (caseDeltas), not attempt pairs; each row shows the case id and the per-arm reading available today (source: sourceRepSchema carries no per-rep grade, comparison-record.ts:142-146, .strict())
- [x] #2 Comparison screen, Attempt-pairs presentation: each arm band renders that arm's gradeDistribution as a count per letter grade, never a synthesized median or a plus/minus range (source: reliabilitySummarySchema has no median/range field, comparison-record.ts:148-163; STAGE_LETTER_GRADES has no plus/minus, config.ts:18; direction 2026-09-07 'I agree, no "range C+ - A-"')
- [x] #3 Comparison screen: the segmented switcher offers Attempt pairs (built) and What moved; What moved renders under the PLANNED/dashed-border/disabled vocabulary SPEC.md section 6 defines for planned features, never as a working tab (source: SPEC.md section 5b needs a per-measure interval and reading verdict that PairedEstimate cannot supply; deferred whole to ACT-104)
- [x] #4 Comparison screen: an attribution claim between two named arms names differing files by deduplicating corpusDifferences(reps[arm].executedCorpus, reps[otherArm].executedCorpus) across every stage pair by file path first, so one file edited once counts once even though it is read at every stage that declares it; the claim renders only when that deduplicated set is empty, and a refusal lists the deduplicated differing paths otherwise, never a silent claim (source: corpusDifferences is called per-stage keyed on record.stage, checkpoint.ts:454-479; SPEC.md section 5b: 'Attribution is only legitimate when exactly one file hash differs... refuse the attribution claim'; subtlety pinned in this card's 2026-09-07 notes: 'one edited file appears once per stage')
- [x] #5 Comparison screen: loading a comparison record through a crafted id whose segment escapes the runs directory is refused, reusing the existing route-level test (source: api.test.ts:134, 'refuses a record id whose segment escapes the runs directory, without a 500')
- [x] #6 Corpus screen renders three columns from data already on disk: Path, Hash, Last edited (via stat), and Read by (a fold over checkpoint corpus-file records); no fourth Invalidated column (source: staleness-report.ts:217 stat() precedent; ACT-110 not yet landed)
- [x] #7 Corpus screen's success response includes the corpus root's real absolute path unredacted (source: direction 2026-09-07, answer to shaping question 1: 'Show the corpus root unredacted... Redaction stays on the error path, unchanged'; redactAbsolutePaths is called only from api.ts's error branches, redact-path.ts, api.ts:56,62,85)
- [x] #8 Corpus screen's header digest is labeled 'corpus root@<hash>' and computed by corpusDigest() over every file in the live corpus tree; run history's existing 'corpus@<hash>' label and meaning (what one stage read) are unchanged; both terms are added to GLOSSARY.md (source: direction 2026-09-07, answer to shaping question 2; corpusDigest is a reusable function over any HashedFile[], corpus-digest.ts; run-history.ts:140 calls it over checkpoint.corpusFiles; GLOSSARY.md defines neither term today, checked 2026-09-08)
- [x] #9 Corpus screen renders the design's dashed-border/reduced-opacity/PLANNED-pill block for the disabled edit-instruction workflow as a design-system component, not inline markup (source: SPEC.md section 6, 'the established vocabulary for planned features... never show a planned control as live'; system-page.tsx:20 already lists 'Planned-feature block, neededBy: ACT-50')
- [x] #10 Both new screens render the design's empty state, observed on a checkout with no records at all (source: card description, 'every screen has the empty state the design specifies')
- [x] #11 Introduces no raw visual value and no component the design system does not already own; anything new is added to the system (source: decision-2)
- [x] #12 Building the comparison screen touches only a new Router route file, its page component, and any new files under client/src/system/components/ -- a prediction from ACT-53 AC #9, confirmed or corrected here (source: direction 2026-09-07, João: 'I agree' to moving ACT-53 AC #9 onto ACT-50; router.tsx has exactly two routes today, /  and /system, checked 2026-09-08)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: ship the comparison screen (attempt-pairs presentation) and the corpus screen, both reading only what the harness already persists on disk, per the four scope decisions and two path/digest answers already signed off in this card's implementation notes (2026-09-07).

First test to write: a server route test asserting corpusDifferences called over two named arms' executedCorpus lists returns empty for a genuinely identical pair and lists the differing files otherwise (covers AC #4) -- write it before the attribution UI, since it fixes the contract the component renders against.

Sequencing:
1. Comparison screen, attempt-pairs table over caseDeltas + gradeDistribution bands (AC #1, #2).
2. Attribution card wired to corpusDifferences (AC #4), with its refusal path tested first.
3. What-moved switcher tab rendered PLANNED/disabled (AC #3).
4. Record-id route refusal test reused against the comparison fetch path (AC #5).
5. Corpus screen: three-column table from stat + checkpoint corpus-file fold (AC #6), unredacted root path in the success body (AC #7), corpus root@<hash> header plus the GLOSSARY.md entries for both digest terms (AC #8), planned-feature-block component (AC #9, already listed as needed in system-page.tsx).
6. Empty states for both screens (AC #10).
7. Confirm AC #12's file-touch prediction once both screens exist; correct it here if wrong.

No comparison record exists on disk today (.benchmark-runs/comparisons is empty), so the comparison screen is built and tested against fixtures unless a real compare run is produced first.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04: narrowed. This card said 'every screen whose data the harness already records', which is six screens in one batch and the opposite of shipping small.

Run history now belongs to ACT-53, which builds it as the walking skeleton for the stack. Run detail, tasks, cases, and calibration are each worth their own card once m-5 has shown what the first screen taught us about the wiring; filing them now would be planning six screens against a design nobody has used yet.

What is left here is the pair that answers the product's own question: comparisons, and the corpus screen that says which recorded results an edit invalidated. Those two together are what m-7 is for.

Vocabulary: this card's labels, routes, and API shapes follow decision-5 and GLOSSARY.md — code/records/CLI keep run, stage, pipeline, case, attempt, rep, confirmation run; the design's task, step, and plural "attempts"/"group" are UI labels only, mapped in GLOSSARY.md.

Criteria conflict, noted 2026-09-07 before shaping. ACs #1 through #6 predate the 2026-09-04 triage that narrowed this card to comparisons and corpus. AC #1 names run history, which ACT-53 built and closed. AC #4 says 'every screen', which under the narrowed scope means these two. Shaping rewrites them against the two screens this card actually builds, per SPEC.md sections 5 (Comparisons) and 6 (Corpus). Not rewritten here, because the shaping stage decides what the criteria become.

ACT-104 (comparison spread as an interval with a per-measure reading verdict) is a backend gap feeding this card's comparison screen and carries no dependency link to it. Shaping decides whether it lands first, inside this card, or after.

Scope decisions, 2026-09-07. Each was put to an independent advisor given the facts and options but not the recommendation, and every load-bearing claim below was re-verified in code by the deciding session.

1. COMPARISON SCREEN, ATTEMPT PAIRS. Build it, rendering what the report actually persists, and accept a documented deviation from SPEC.md 5a. The design's table has one row per paired attempt with a grade per arm; the report cannot feed that. reliabilitySummarySchema (src/benchmark/comparison-record.ts) persists only gradeDistribution as a count map, and sourceRepSchema carries path, sha256, repId, ordinal with no grade. Both schemas are .strict(). Filed as ACT-109. Until it lands, table rows are cases, which is the unit the harness actually pairs on (caseDeltas, keyed by caseId), and the arm band renders gradeDistribution rather than a median and range. Median and range themselves are about an hour's work and are ACT-102; they were never the blocker.

   Deviation needing João's sign-off, since the card says to build against the committed design: SPEC 5a's arm band reads 'range C+ - A-', and STAGE_LETTER_GRADES (src/benchmark/config.ts:18) is five letters with no plus or minus, so that string is unsatisfiable under any option. If the notation is meant literally it changes the grade scale every recorded grade and rubric depends on, which is its own card.

2. COMPARISON SCREEN, WHAT MOVED. Not in this card. It needs an interval and a per-measure reading verdict, which is ACT-104 word for word. A 95% interval is a routine default, since docs/research.md adopts that error-bar framing and both terms exist. The verdict is not: three of SPEC 5b's five phrases cannot be derived from a single PairedEstimate under any threshold, because 'clearest movement' ranks measures against each other and blocker rows are counted rather than graded. Ship Attempt pairs only; render the second switcher option under the PLANNED vocabulary SPEC section 6 already defines.

3. ATTRIBUTION CLAIM. Build it here. executedCorpus is persisted per arm as {path, sha256} (comparison-record.ts:234), and corpusDifferences (src/benchmark/checkpoint.ts:396) already takes exactly that shape, so this is a call plus a branch, not a new capture path.

   Four subtleties the criteria must pin, all verified: snapshotStageCorpus writes a full corpus copy per stage, so one edited file appears once per stage and a naive 'exactly one entry differs' check refuses a genuine single-file edit; the baseline arm is defined by a REMOVAL, so treating 'modified' as the only difference makes a stripped-skill baseline read as identical; the claim is about a named pair of arms, and computing one pair while labelling it another is a false claim; a refusal should list the differing files, since corpusDifferences already returns them sorted.

   Out of scope: SPEC 5's 'See the diff between arms' button needs file text, which the report does not carry. Its own card if wanted.

4. CORPUS SCREEN. Build it with three of the design's columns, not one. Verified derivable from data already on disk: last-edited via stat, with staleness-report.ts:217 as the in-repo precedent, and read-by as a fold over the corpus paths every checkpoint records (a checkpoint on disk carries 89). Only the invalidated count is split out, as ACT-110, because deriving it today means parsing three English cause wordings plus two error shapes, and because nothing on disk defines 'the last edit' its header card counts against.

   Two calls for shaping, neither decided here. The screen would put an absolute corpus root path in a SUCCESSFUL response body, and redactAbsolutePaths only wraps errors today; the design shows the path deliberately, so this is a product call. And a corpus-screen 'corpus@<hash>' digests the whole live corpus while run history's digests what one stage read, so two screens would show different values for what a reader takes to be the same corpus; make the distinction visible or the numbers will be read as a bug.

   Also owed: client/src/system/system-page.tsx already lists a 'Planned-feature block' component as needed by this card's corpus screen, and it does not exist. AC #6 requires it in the design system rather than inline.

There is no recorded comparison on disk (.benchmark-runs/comparisons is empty), so the comparison screen will be verified against fixtures unless someone spends a compare run.

Direction, 2026-09-07, on the one deviation held open above: 'I agree, no "range C+ - A-"'. The arm band does not render a plus/minus grade range. It renders what the five-letter scale in STAGE_LETTER_GRADES supports. The grade scale itself is not changed by this card, and plus/minus notation is not carried forward as a question.

Answers to shaping's two questions, 2026-09-07.

1. PATH EXPOSURE. Show the corpus root unredacted in the corpus screen's success response, as the design draws it. redactAbsolutePaths exists because an error can carry a path the operator never asked to see, from a corpus root or target repo outside CONTROL_DIR. This is the opposite case: the path is the screen's subject, the operator declared it, and the server is theirs on their own machine. Redaction stays on the error path, unchanged.

2. THE TWO DIGESTS. Give them different names, because they are different quantities and neither is currently named at all (verified: GLOSSARY.md defines no term for either, and run-history.ts:140 digests checkpoint.corpusFiles, the files one stage read).

   'corpus@<hash>' keeps its existing meaning on run history: what a stage actually read. The corpus screen's digest is over the whole live tree, including files no stage ever read, and it renders as 'corpus root@<hash>'.

   Both terms go into GLOSSARY.md as part of this card, since decision-5 makes the glossary where this vocabulary is settled and a term used on two screens with two meanings is exactly what it exists to prevent.

Shaped 2026-09-08. This card's own 2026-09-07 notes already carried four signed-off scope decisions and both shaping-question answers; nothing here reopens them. All load-bearing code claims re-verified this session: comparison-record.ts's sourceRepSchema/reliabilitySummarySchema/executedCorpus, .strict() on both; checkpoint.ts:396 corpusDifferences returns sorted per-path diffs; run-history.ts:140 and corpus-digest.ts confirm corpus@<hash> is reusable over any file list for corpus root@<hash>; staleness-report.ts:217 stat() precedent; system-page.tsx:20 already lists the Planned-feature block as owed to this card; redact-path.ts confirms redaction is error-path only; api.test.ts:134 is the existing record-id-escape refusal test AC #5 reuses. router.tsx today has exactly two routes (/, /system), consistent with AC #12's prediction of one new route file.

Rewrote ACs #1-6 (stale, predating the 2026-09-04 triage that narrowed this card off run history onto comparisons + corpus) into 9 criteria against the two screens this card actually builds, each carrying its source. Kept the file-touch prediction (was #7) as #12. Corrected two artifacts of an --ac/--acceptance-criteria mixup mid-session: an accidental append duplicated criteria, fixed by a single --acceptance-criteria replace to the correct final 12.

No new unknowns found worth sending back; the plan sequences the six ACs against SPEC.md sections 5 and 6.

Adversarial review 2026-09-08 (reviewer agent, unprimed). Findings and disposition:

BLOCKING #1 (no AC carried its required trailing parenthetical source, per backlog-board.md) -- fixed: all 12 criteria rewritten with a (source: ...) clause each, citing the code line, SPEC.md section, direction quote, or decision it rests on.

BLOCKING #2 (AC #4's attribution rule did not state the per-stage dedup the notes themselves flagged as needing pinning) -- fixed: AC #4 now states the rule explicitly (dedupe corpusDifferences results across every stage pair by file path before counting), re-verified against checkpoint.ts:454-479, which calls corpusDifferences once per stage keyed on record.stage.

SHOULD-FIX #3 (AC #1/#2 read as governing the whole comparison screen, not just the built Attempt-pairs tab, risking a build session over-scoping them against the deferred What-moved presentation) -- fixed: both now open with 'Comparison screen, Attempt-pairs presentation:'.

SHOULD-FIX #4 (AC #12 predicts file-touch scope, not an observable product behavior) -- not fixed, disposition: kept as-is. It was moved onto this card by explicit direction with the quote sitting beside it ('moved from ACT-53 on João's direction... I agree'), which is exactly the board rule's carve-out for a criterion that names an approach because a direction asked for it: quote it and let the direction's author correct it, rather than the session rewriting it into a behavior no one asked for.

NOTE #5 (all load-bearing code claims re-verified independently, none found wrong) -- no action needed, confirms this session's own re-verification.

NOTE #6 (GLOSSARY.md confirmed to define neither corpus@<hash> nor corpus root@<hash> today) -- no action needed.

NOTE #7 (plan's first-test choice confirmed as the cheapest gating step) -- no action needed.

NOTE #8 (sign-off provenance, 'per João's direction,' is not independently verifiable by any tool) -- not fixed, disposition: accepted as an inherent limit. The quoted direction is the only record of it and is already quoted rather than asserted as fact; no tool in this repository can verify authorship of a prior conversation turn.

One round run, no second round needed: both blocking findings were fixed and re-verified against the same code the review cited (checkpoint.ts:454-479 for #4; the AC text itself for #1).

Oversight probes, 2026-09-08, at the build's mid-card checkpoint. Verified directly rather than taken from the session's report: full suite green from a fresh run (1149 server, up from 1142; 81 client, up from 78), typecheck and lint clean, tree clean across the three commits. The crafted-digest refusal is really pinned: replacing parseRecordId on the comparison route with an unvalidated id fails all three tests in src/server/comparisons.test.ts, including the escape-refusal one. Restored after the probe.

Directed to continue the remaining criteria in the same sequence.

AC #12 file-touch prediction, checked against the actual build: the comparison screen build (e279864, 9525efa, a028652, 94530c6) touched client/src/comparison/comparison-page.{tsx,css,test.tsx}, client/src/router.tsx, client/src/router.test.tsx, and client/src/system/components/switcher.{tsx,css,test.tsx}, matching the prediction. Two touches outside it were necessary and are not scope creep: client/src/test-support/fetch-stub.ts gained stubFetchByPath (a page calling more than one endpoint needs a keyed stub, not a new shape of its own), and client/src/system/system-page.tsx gained the Switcher showcase section, which AC #11 already requires for every new design-system component. Corrected: the prediction holds for the route and page, undercounts by two files that any new design-system component or multi-endpoint page would also touch.

Code review 2026-09-08 (review-code skill), six reviewer agents in parallel, one round: Spec conformance, Style, Architecture, Security, Testing, Refactoring. Full suite green before dispatch (1154 server + 98 client tests, bun run test). Diff reviewed: 3af6536..HEAD (34 files, ~1574 insertions) via /tmp/act-50-review/diff.patch.

Spec conformance (docs/design-handoff/SPEC.md sections 5/6, wiki-checks Spec section; all 34 files examined): AC-by-AC walk present for #1,#2,#3,#5,#6,#7,#8,#9,#10,#11,#12; #4 partial. BLOCKING finding: the attribution dedup fix (AC #4) operated on the wrong path shape and could falsely refuse a genuine single-file edit in real pipeline data.

Style (coding-style.md, coding-style-typescript.md, coding-style-frontend.md, doctrine Code craft): should-fix, 6 duplicate/mirrored attribution cards render per case instead of 3 (armPairs() built every ordered pair, not the report's 3 canonical contrasts); should-fix, doc comment on armPairLabel asserted single-source-of-truth while the client held its own copy; note, ComparisonArmPair type exported but never referenced; note, api.ts's two route handlers share an error-translation shape (Repeated Switches, routed to Refactoring, not a Style defect).

Architecture (engineering-judgment.md, coupling.md, doctrine Architecture, coding-style.md layering sections): should-fix, functional coupling — armPairLabel duplicated between server and client was avoidable, since the function has no real dependency on the Node-only code that made the rest of comparisons.ts unsafe for the client to import (traced the import graph precisely). Note (strength, load-bearing): the client's existing  for ComparisonAttribution is verified safe under verbatimModuleSyntax; flagged so a future edit doesn't widen it to a value import.

Security (wiki-checks Security section, no house security file): nothing found. Verified /api/corpus's unredacted root exposure is the signed-off product decision with no reachable privilege boundary crossed (no auth layer anywhere in src/server/); probed parseRecordId directly against traversal variants, all refused; no XSS sink in any new component. Independently corroborated the armPairLabel duplication (non-security, noted for completeness).

Testing (testing/00-index.md, 01/02/03, wiki-checks): should-fix, comparisons.test.ts's armPairLabel test asserted two independent rows in one body instead of it.each; should-fix, router.test.tsx's two new route tests hand-repeated wiring renderAt exists to remove (Test Code Duplication). Note: dedupedByPath's same-arm-different-hash-within-one-path case is untested (no test in comparison-attribution.test.ts covers it). Ran and verified two mutation probes (dedup call removed: 2/4 tests fail as expected; run-vs-checkpoint counting: traced correct). Independently corroborated the armPairLabel duplication.

Refactoring (advisory; reviewer did not load the refactoring index/catalog this session, so offered no scored refactoring-axis verdict, but reported two [correctness]-tagged findings, which any axis may): BLOCKING, reproduced directly — corpusReport threw an unhandled ENOENT and 500'd the whole /api/corpus route on any incomplete checkpoint directory anywhere in the runs directory. Independently reproduced the 6-vs-3 attribution-card bug via a live probe against the route. Note: same dedupedByPath gap Testing found.

Disposition of every finding:
1. BLOCKING (Spec/Refactoring, corroborated Architecture/Security/Testing): attribution dedup false-refuses on real pipeline path shapes — FIXED, commit 9c72924 (layoutPath() strips the stage segment before deduping; reproduced the bug directly before the fix, both the new and pre-existing comparison-attribution.test.ts cases green after).
2. BLOCKING (Refactoring, reproduced directly by this session too): corpusReport crashes on an incomplete checkpoint — FIXED, commit f231e4b (readCountsByPath skips an unparseable checkpoint, matching list-command.ts's collect() discipline; reproduced the crash directly before the fix).
3. SHOULD-FIX (Style, corroborated Architecture/Refactoring): 6 duplicate attribution cards instead of 3 — FIXED, commit 13e5b9d (armPairs() returns only the report's 3 canonical contrasts; ComparisonArmPair's now-fully-dead export removed in the same commit).
4. SHOULD-FIX (Architecture, corroborated Security/Testing/Style): armPairLabel duplicated between server and client, and the duplication was avoidable — FIXED, commit 685cb07 (extracted to comparison-arm-pair.ts, a module with only a type-only import; verified via vite v8.2.2 building client environment for production...
transforming...
✓ 183 modules transformed.
rendering chunks...
computing gzip size...
client/dist/index.html                                                   0.37 kB │ gzip:   0.26 kB
client/dist/assets/jetbrains-mono-greek-400-normal-C190GLew.woff2        4.22 kB
client/dist/assets/jetbrains-mono-greek-500-normal-JpySY46c.woff2        4.28 kB
client/dist/assets/jetbrains-mono-greek-700-normal-C6CZE3T8.woff2        4.30 kB
client/dist/assets/inter-vietnamese-400-normal-DMkecbls.woff2            4.97 kB
client/dist/assets/inter-vietnamese-600-normal-Cc8MFFhd.woff2            5.10 kB
client/dist/assets/inter-vietnamese-500-normal-DOriooB6.woff2            5.11 kB
client/dist/assets/inter-greek-ext-400-normal-DGGRlc-M.woff2             5.26 kB
client/dist/assets/jetbrains-mono-cyrillic-400-normal-BEIGL1Tu.woff2     5.32 kB
client/dist/assets/jetbrains-mono-cyrillic-700-normal-BWTpRfYl.woff2     5.33 kB
client/dist/assets/jetbrains-mono-cyrillic-500-normal-DmUKJPL_.woff2     5.35 kB
client/dist/assets/jetbrains-mono-vietnamese-400-normal-CqNFfHCs.woff    5.37 kB
client/dist/assets/inter-greek-ext-500-normal-C4iEst2y.woff2             5.42 kB
client/dist/assets/inter-greek-ext-600-normal-DRtmH8MT.woff2             5.43 kB
client/dist/assets/jetbrains-mono-vietnamese-700-normal-BDLVIk2r.woff    5.45 kB
client/dist/assets/jetbrains-mono-vietnamese-500-normal-DNRqzVM1.woff    5.47 kB
client/dist/assets/jetbrains-mono-greek-400-normal-B9oWc5Lo.woff         5.66 kB
client/dist/assets/jetbrains-mono-greek-700-normal-DEigVDxa.woff         5.69 kB
client/dist/assets/jetbrains-mono-greek-500-normal-D7SFKleX.woff         5.72 kB
client/dist/assets/inter-vietnamese-400-normal-Bbgyi5SW.woff             6.50 kB
client/dist/assets/inter-vietnamese-500-normal-mJboJaSs.woff             6.59 kB
client/dist/assets/inter-vietnamese-600-normal-BuLX-rYi.woff             6.64 kB
client/dist/assets/jetbrains-mono-cyrillic-400-normal-ugxPyKxw.woff      6.97 kB
client/dist/assets/jetbrains-mono-cyrillic-700-normal-CEoEElIJ.woff      7.01 kB
client/dist/assets/jetbrains-mono-cyrillic-500-normal-DJqRU3vO.woff      7.02 kB
client/dist/assets/inter-greek-ext-400-normal-KugGGMne.woff              7.06 kB
client/dist/assets/inter-greek-ext-500-normal-2j5mBUwD.woff              7.19 kB
client/dist/assets/inter-greek-ext-600-normal-B8X0CLgF.woff              7.21 kB
client/dist/assets/jetbrains-mono-latin-ext-400-normal-Bc8Ftmh3.woff2    7.33 kB
client/dist/assets/jetbrains-mono-latin-ext-700-normal-CZipNAKV.woff2    7.47 kB
client/dist/assets/jetbrains-mono-latin-ext-500-normal-Cut-4mMH.woff2    7.52 kB
client/dist/assets/inter-cyrillic-400-normal-obahsSVq.woff2              7.71 kB
client/dist/assets/inter-greek-400-normal-B4URO6DV.woff2                 7.77 kB
client/dist/assets/inter-cyrillic-500-normal-BasfLYem.woff2              7.90 kB
client/dist/assets/inter-greek-500-normal-BIZE56-Y.woff2                 7.92 kB
client/dist/assets/inter-greek-600-normal-plRanbMR.woff2                 7.94 kB
client/dist/assets/inter-cyrillic-600-normal-CWCymEST.woff2              7.97 kB
client/dist/assets/inter-cyrillic-400-normal-HOLc17fK.woff               9.78 kB
client/dist/assets/inter-greek-400-normal-q2sYcFCs.woff                  9.92 kB
client/dist/assets/inter-cyrillic-600-normal-4D_pXhcN.woff               9.93 kB
client/dist/assets/inter-cyrillic-500-normal-CxZf_p3X.woff               9.94 kB
client/dist/assets/inter-greek-500-normal-Xzm54t5V.woff                  9.98 kB
client/dist/assets/inter-greek-600-normal-BZpKdvQh.woff                 10.03 kB
client/dist/assets/jetbrains-mono-latin-ext-400-normal-fXTG6kC5.woff    10.12 kB
client/dist/assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2         10.23 kB
client/dist/assets/jetbrains-mono-latin-ext-700-normal-CxPITLHs.woff    10.30 kB
client/dist/assets/jetbrains-mono-latin-ext-500-normal-ckzbgY84.woff    10.33 kB
client/dist/assets/inter-cyrillic-ext-500-normal-B0yAr1jD.woff2         10.43 kB
client/dist/assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2         10.48 kB
client/dist/assets/inter-cyrillic-ext-400-normal-DQukG94-.woff          13.33 kB
client/dist/assets/inter-cyrillic-ext-500-normal-BmqWE9Dz.woff          13.45 kB
client/dist/assets/inter-cyrillic-ext-600-normal-Bcila6Z-.woff          13.46 kB
client/dist/assets/jetbrains-mono-latin-400-normal-V6pRDFza.woff2       21.16 kB
client/dist/assets/jetbrains-mono-latin-500-normal-BWZEU5yA.woff2       21.83 kB
client/dist/assets/jetbrains-mono-latin-700-normal-BYuf6tUa.woff2       21.90 kB
client/dist/assets/inter-latin-400-normal-C38fXH4l.woff2                23.66 kB
client/dist/assets/inter-latin-500-normal-Cerq10X2.woff2                24.27 kB
client/dist/assets/inter-latin-600-normal-LgqL8muc.woff2                24.45 kB
client/dist/assets/jetbrains-mono-latin-400-normal-6-qcROiO.woff        27.49 kB
client/dist/assets/jetbrains-mono-latin-500-normal-CJOVTJB7.woff        28.20 kB
client/dist/assets/jetbrains-mono-latin-700-normal-D3wTyLJW.woff        28.20 kB
client/dist/assets/inter-latin-400-normal-CyCys3Eg.woff                 30.69 kB
client/dist/assets/inter-latin-600-normal-CiBQ2DWP.woff                 31.26 kB
client/dist/assets/inter-latin-500-normal-BL9OpVg8.woff                 31.28 kB
client/dist/assets/inter-latin-ext-400-normal-C1nco2VV.woff2            35.00 kB
client/dist/assets/inter-latin-ext-500-normal-CV4jyFjo.woff2            36.02 kB
client/dist/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2            36.26 kB
client/dist/assets/inter-latin-ext-400-normal-77YHD8bZ.woff             47.56 kB
client/dist/assets/inter-latin-ext-500-normal-BxGbmqWO.woff             48.49 kB
client/dist/assets/inter-latin-ext-600-normal-CIVaiw4L.woff             48.66 kB
client/dist/assets/index-BhDWee75.css                                   49.79 kB │ gzip:  23.74 kB
client/dist/assets/index-C8CVoTEm.js                                   319.76 kB │ gzip: 101.13 kB

✓ built in 169ms plus a grep over the built bundle for node:crypto/node:fs, zero matches). This closes ACT-111, which had filed the duplication as a card before the review found a cheaper fix existed.
5. SHOULD-FIX (Testing): loop-style multi-assert test — FIXED, commit 13e5b9d (folded into the it.each added alongside the 3-pairs fix, since the same test needed updating anyway).
6. SHOULD-FIX (Testing): router.test.tsx wiring duplication — FIXED, commit 82b2e30 (renderAt/renderAtWithStub share renderRouterAt).
7. NOTE (Testing/Refactoring): dedupedByPath's same-arm-different-hash-within-one-path case is untested and its correct behavior undecided — TRACKED, filed ACT-112 (a product call on what should happen when one arm's own corpus is internally inconsistent across its own stages, not a defect in what was asked for here).
8. NOTE (Style): ComparisonArmPair dead export — resolved as a side effect of disposition #3 (removed).
9. NOTE (Style): api.ts's two route handlers share an error-translation shape — NOT FIXED, no axis scored this as an actionable finding (Style explicitly routed it to Refactoring, which did not independently flag it); left as a descriptive observation only.
10. Refactoring's aside on stubFetchByPath silently returning 200/null-body on an unstubbed path — NOT FIXED, cited only as evidence for how finding #3 went unnoticed, no axis scored it as its own defect.

Full suite re-verified green after every fix: 1160 server + 98 client tests (bun run test), tsc --noEmit clean on both tsconfigs, oxlint --type-aware clean.
<!-- SECTION:NOTES:END -->
