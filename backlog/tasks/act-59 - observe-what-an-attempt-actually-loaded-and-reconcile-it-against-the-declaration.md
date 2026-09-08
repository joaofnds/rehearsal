---
id: ACT-59
title: >-
  observe what an attempt actually loaded and reconcile it against the
  declaration
status: Build
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 11:33'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-9 - context-manifest-design.md
priority: high
ordinal: 56008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A session case declares its corpus files by hand and nothing checks that declaration against what the session actually loaded. A case that forgets a skill still runs, and its attempt record then claims a corpus the session never read. That is a recorded measurement of a corpus that did not exist, the same class of defect as ACT-41.

The provider already records the loads. Verified 2026-09-04 against .benchmark-runs/cases/brief-reply-02f0f204/02f0f204-613d-49d2-8999-67ba79fedbb1-cut-1270.jsonl (1270 lines):

    jq -r 'select(.type=="attachment") | .attachment.type' <file> | sort | uniq -c
    219 output_style, 217 total_tokens_reminder, 3 queued_command, 3 edited_text_file, 2 command_permissions, 1 skill_listing, 1 mcp_instructions_delta, 1 deferred_tools_delta, 1 auto_mode, 1 agent_listing_delta

An output_style attachment carries {type, style} where style is the name ('brief'). A skill_listing carries the full listing text. A Skill tool call names the skill invoked:

    jq -c 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use" and .name=="Skill") | .input' <file>
    {"skill":"doctrine","args":"quality at source, defect prevention, systemic cause, Deming"}

The constraint that shapes the design: the transcript names loads but does not carry their bytes. The live corpus CLAUDE.md content ('Working with Joao') appears zero times in that transcript. So reconciliation is name-against-name, and hashes keep coming from the corpus resolver, never from the transcript. No transcript parsing needs to understand instruction content.

src/benchmark/transcript.ts today parses only message content blocks for tool_use, and filesRead sees only explicit Read calls. Attachment records are dropped entirely.

Design: backlog/docs/doc-9 - context-manifest-design.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An attempt whose transcript carries a Read tool_use on a corpus-layout path reports that path as a manifest entry, unchanged from today's filesRead behavior (src/benchmark/transcript.ts existing filesRead)
- [ ] #2 The reconciliation is name-against-name: no manifest or divergence logic hashes or compares transcript-carried bytes against corpus bytes, since the transcript does not carry the corpus's own bytes (doc-9 gap 2, verified 2026-09-08: live CLAUDE.md content appears zero times in the sampled transcript)
- [ ] #3 An attempt whose transcript carries a Skill tool_use naming a skill reports that skill's layout path (skills/<name>/SKILL.md) as a manifest entry; a skill merely offered in a skill_listing but never invoked reports no manifest entry for it (doc-9 gap 1; skill_listing's names field lists offered skills only, confirmed against cases/manifest-probe fixture line 4, which lists 14 offered skills against the one, verify, actually invoked at line 14)
- [ ] #4 An attempt whose transcript carries one or more output_style attachments reports the last one's style as the layout path (output-styles/<name>.md) manifest entry for output style; a transcript naming two different styles across its output_style attachments is a case this card leaves for a follow-up to define further, but the last-wins rule is what this card's implementation follows (doc-9 gap 1; the manifest-probe fixture carries 4 output_style records, all naming brief, so it cannot exercise a style change and does not need to)
- [ ] #5 A manifest entry naming a layout path the case's corpusFiles did not declare is reported as an undeclared-file divergence, naming the file (this card's own AC for undeclared-file divergence, listed separately from unloaded-file divergence below)
- [ ] #6 A declared corpusFiles entry absent from the observed manifest is reported as an unloaded-file divergence, naming the file; a test for this needs a corpus file that resolves and hashes successfully in hashCorpusFiles (src/benchmark/corpus-file.ts) so the attempt still runs, while never being read by the session, so the divergence path is reached rather than short-circuited by the existing pre-flight missing-file refusal (this card's own AC for unloaded-file divergence)
- [ ] #7 Building the manifest and its divergence report reads only records already on disk (transcript file, case declaration) and makes no provider call, exercised by a test over the committed cases/manifest-probe fixture (a0491c04-...-cut-24.jsonl) (fixture captured 2026-09-08)
- [ ] #8 A transcript record of a type the parser does not recognize is skipped and yields no manifest entry and no divergence, never a failed attempt (confirmed by prior triage 2026-09-08)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-07: assigned m-3, per doc-16/doc-22/doc-23's unopposed recommendation carried across three prior triage runs.

Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Overseeing session, 2026-09-08, probing the shape session's findings.

Fixture (its question 1): shape reported one live transcript, from another repo, unsuitable. There are three on disk. The two it did not examine are this repo's own session transcripts under .benchmark-runs/sessions/brief-reply-92b2e8b0/*/transcript.jsonl (1280 lines each, byte-identical inventories). They still carry no Skill and no Read tool_use — the session used Bash, Edit, Write, Agent, ToolSearch — so its conclusion stands for the wrong reason: the gap is that no session yet recorded has invoked a skill or a Read, not that the only fixture is foreign. Capturing a fresh on-topic session remains the answer.

nested_memory (its question 2): confirmed, and doc-9's constraint is wrong as stated. The attachment carries keys [content, displayPath, path, type] and its content field holds the loaded file's full bytes inline (~10KB in this instance). Two bounds keep it from reaching this card. The single nested_memory record here names /Users/joaofnds/code/trunk/.claude/rules/commit-graph.md, a path outside both the corpus and the target, and the live corpus CLAUDE.md content ('Working with Joao') appears zero times in the transcript. So bytes do reach the transcript, but not the corpus's bytes, and doc-9's operative conclusion — reconciliation is name-against-name, hashes come from the corpus resolver — survives. What fails is its stated reason.

skill_listing (the shape session left this unconfirmed): keys are [content, isInitial, names, skillCount, type]. names is a plain array of skill-name strings (absorb, build, debug, doctrine, refactor, review-instructions, shape, ship). output_style is {type, style} with style the bare name, as doc-9 says.

Unrecognized types (its question 3): confirmed as it proposed. Skip silently, never a divergence. AC#5's 'a record type the parser does not recognize yields no manifest entry' says exactly this, and a divergence is reserved for a corpus-file mismatch under AC#2 and AC#3.

Fixture captured, 2026-09-08, at João's direction. New session case `manifest-probe` (cases/manifest-probe/) declares tools [Read, Skill] against a small fixture tree; its committed prefix a0491c04-...-cut-24.jsonl carries one Read, one Skill naming verify, an output_style attachment and a skill_listing, in 24 lines. AC#4 now has its fixture.

Two defects found while capturing, both filed rather than fixed here: ACT-116 (case capture resolves session ids only against ~/.claude/projects, so it cannot capture a harness run, which passes --no-session-persistence; the prefix was placed and hashed by hand) and ACT-117 (the model preflight probe's $0.02 cap is close enough to real cost that a cold-cache completion exhausts it, and the harness reports that as an unavailable model).

The case's own word-band check fails at 131 words against a 120 cap. Deliberate: the case exists to emit transcript records, and its checks are not what this card reads.

Shape (this session), 2026-09-08:

Goal: give a session attempt's record an observed context manifest (output style, skills, corpus files read) built from the transcript already on disk, and reconcile it against the case's declared corpusFiles, reporting either-direction mismatches as named divergences.

Unknowns: none open. doc-9 plus three prior triage rounds already settled every question a shape pass would raise: the attachment/tool_use shapes to parse (output_style, skill_listing, Skill tool_use, Read tool_use), the name-only reconciliation boundary (transcript never carries corpus bytes, hashes stay with the corpus resolver), unrecognized-record handling (skip silently, never a divergence), and the AC#4 fixture (cases/manifest-probe, captured 2026-09-08). Nothing here needed a fresh question back to the requester.

Where it lands in code (read this session, not yet written): src/benchmark/transcript.ts today parses only tool_use blocks (toolUses, filesRead) and drops attachment records entirely; it gains parsing for output_style and skill_listing/Skill-invocation records. Layout-path naming for an observed entry reuses src/benchmark/corpus-file.ts's existing convention (CORPUS_INSTRUCTIONS_PATH, CORPUS_LAYOUT_DIRECTORIES: output-styles/, skills/, agents/) rather than inventing a second one. The manifest and its divergence list are new fields on sessionAttemptRecordSchema (src/benchmark/session-record.ts, currently .strict() with corpusFiles: HashedFile[]); that schema is version-gated (schemaVersion: z.literal(1)) so adding fields is a version bump, a build-time call for coding-style/testing rules, not a shaping one.

First test to write: a unit test over the committed fixture cases/manifest-probe/a0491c04-fb39-42b6-851e-37aba8250e82-cut-24.jsonl (24 lines: one Read, one Skill naming "verify", one output_style attachment, one skill_listing) asserting the built manifest contains exactly {output-styles/brief.md, skills/verify/SKILL.md} and reconciling it against that case's declared corpusFiles (the same two paths) yields zero divergences. A second case/fixture pair with a deliberately mismatched declaration is needed to exercise AC#4/#5 (undeclared-file and unloaded-file divergence) — not yet captured; build can reuse manifest-probe's fixture tree with an edited case.json declaration for that, no new transcript capture required.

Glossary: no new terms. "Context manifest" is already in GLOSSARY.md:98 from doc-9.

No design survey: doc-9 already ran it and gave the single buildable approach (observe from transcript, reconcile name-only against the corpus resolver's hashes); nothing since has reopened it.

Adversarial review (reviewer agent), 2026-09-08, disposition:

Blocking, folded: the skill_listing criterion said a skill merely *listed* as offered (skill_listing.names, 14 entries in the fixture) counted as loaded. It only lists offered skills; only the Skill tool_use (or a Read of the skill file) shows invocation. Rewrote the criterion to require an actual Skill tool_use, matching what the "first test" paragraph below already assumed for this same fixture (manifest = {output-styles/brief.md, skills/verify/SKILL.md}, not all 14 offered skills).

Should-fix, folded: AC wording named stale AC numbers from an earlier draft ("card AC#2"/"card AC#4" etc.) that no longer matched the card's own current numbering; every cross-reference is now removed since restating "this card's own AC for X" needs no number that future edits will re-break.

Should-fix, folded: the output-style criterion didn't say what happens when a transcript carries output_style records naming two different styles (the doc-9 sample had 219 such records; the manifest-probe fixture has 4, all identical, so it can't force the question). Added a last-wins rule as this card's implementation choice, with the fixture's inability to test a style-change noted so a later card can visit multi-style transcripts if one is ever captured.

Should-fix, folded: the unloaded-file divergence criterion didn't say a test fixture for it needs a corpus file that hashes successfully (via hashCorpusFiles's pre-flight existence check) while never being read, or the divergence code path is unreachable because the attempt fails before the manifest is ever built. Added that constraint directly to the criterion.

Note, accepted as correctly scoped: doc-9's name-only reconciliation call was re-examined same-day against the nested_memory correction and still holds; no design survey needed for that question. The glossary's context-manifest entry mentions a per-entry "tier" classification that no AC here assigns — left to whichever future card actually adds that field, since doc-9 assigns tier work to no specific card and this one closes only gap 1 (reconciliation).

Findings not folded: none. Every blocking and should-fix finding was folded into the ACs directly; no finding was deferred.

Correction to this session's earlier "First test to write" paragraph, 2026-09-08: that paragraph's proposed second fixture ("edit case.json's corpusFiles field, keep the same transcript") is directionally right but incomplete as written. For the unloaded-file divergence case specifically, the edited case.json must declare a corpus file that still exists and hashes successfully (hashCorpusFiles in src/benchmark/corpus-file.ts refuses a declared file that doesn't resolve, before any manifest logic runs), while the transcript shows it was never read. Dropping skills/verify/SKILL.md from the declaration would not do this, since manifest-probe's fixture tree still has that file on disk; a genuine unloaded-file test needs a declared file that resolves (e.g., point at a real file elsewhere in corpus layout, or add one to the fixture tree) but that the transcript's Read/Skill records never touch. The undeclared-file case (AC for undeclared-file divergence) has no such constraint: adding an unrelated file to the fixture's own corpus layout and NOT declaring it in case.json is sufficient, since nothing needs to pre-resolve it.
<!-- SECTION:NOTES:END -->
