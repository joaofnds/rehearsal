---
id: ACT-59
title: >-
  observe what an attempt actually loaded and reconcile it against the
  declaration
status: Done
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 11:55'
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
- [x] #1 An attempt whose transcript carries a Read tool_use on a corpus-layout path reports that path as a manifest entry, unchanged from today's filesRead behavior (src/benchmark/transcript.ts existing filesRead)
- [x] #2 The reconciliation is name-against-name: no manifest or divergence logic hashes or compares transcript-carried bytes against corpus bytes, since the transcript does not carry the corpus's own bytes (doc-9 gap 2, verified 2026-09-08: live CLAUDE.md content appears zero times in the sampled transcript)
- [x] #3 An attempt whose transcript carries a Skill tool_use naming a skill reports that skill's layout path (skills/<name>/SKILL.md) as a manifest entry; a skill merely offered in a skill_listing but never invoked reports no manifest entry for it (doc-9 gap 1; skill_listing's names field lists offered skills only, confirmed against cases/manifest-probe fixture line 4, which lists 14 offered skills against the one, verify, actually invoked at line 14)
- [x] #4 An attempt whose transcript carries one or more output_style attachments reports the last one's style as the layout path (output-styles/<name>.md) manifest entry for output style; a transcript naming two different styles across its output_style attachments is a case this card leaves for a follow-up to define further, but the last-wins rule is what this card's implementation follows (doc-9 gap 1; the manifest-probe fixture carries 4 output_style records, all naming brief, so it cannot exercise a style change and does not need to)
- [x] #5 A manifest entry naming a layout path the case's corpusFiles did not declare is reported as an undeclared-file divergence, naming the file (this card's own AC for undeclared-file divergence, listed separately from unloaded-file divergence below)
- [x] #6 A declared corpusFiles entry absent from the observed manifest is reported as an unloaded-file divergence, naming the file; a test for this needs a corpus file that resolves and hashes successfully in hashCorpusFiles (src/benchmark/corpus-file.ts) so the attempt still runs, while never being read by the session, so the divergence path is reached rather than short-circuited by the existing pre-flight missing-file refusal (this card's own AC for unloaded-file divergence)
- [x] #7 Building the manifest and its divergence report reads only records already on disk (transcript file, case declaration) and makes no provider call, exercised by a test over the committed cases/manifest-probe fixture (a0491c04-...-cut-24.jsonl) (fixture captured 2026-09-08)
- [x] #8 A transcript record of a type the parser does not recognize is skipped and yields no manifest entry and no divergence, never a failed attempt (confirmed by prior triage 2026-09-08)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Build (this session), 2026-09-08.

Implemented across 8 commits: observedManifest/reconcileManifest (src/benchmark/context-manifest.ts,
new), transcript.ts gained outputStyles and skillsInvoked plus attachment-record parsing,
SessionAttempt gained contextManifest (src/benchmark/session-attempt.ts), the schema gained
contextManifest/divergences as optional fields under schemaVersion 1 (src/benchmark/session-record.ts,
following corpusOrigin's precedent), and buildAttemptRecord (src/cli/session-run-command.ts) reconciles
and writes both. isCorpusLayoutPath moved to corpus-file.ts as the single shared predicate, reused by
resolveCorpusFile and the manifest builder.

Review (6 axes, all backgrounded reviewer agents, one round): Spec, Style, Architecture, Security,
Testing, Refactoring. Two defects found and fixed, both independently reproduced by 2+ reviewers each:

- Blocking (Security, Architecture, Testing): the manifest was built from the whole parsed transcript,
  not sliced by the transcript-prefix cut the way checks already are. A resumed session's seeded prefix
  therefore leaked into the current attempt's manifest, producing false divergences for exactly the
  case shape the manifest-probe fixture itself uses (a transcript prefix + declared corpusFiles). Fixed:
  contextManifest now built from the same transcript.slice(cut) checks already use. New regression test:
  "excludes a skill invoked only in the seeded transcript prefix from the recorded context manifest".

- Should-fix (Style, Spec, Architecture, Refactoring, four independent reviewers): isCorpusLayoutPath
  never matched CLAUDE.md (only checked the three CORPUS_LAYOUT_DIRECTORIES prefixes, drifting from
  resolveCorpusFile's own predicate which treats CORPUS_INSTRUCTIONS_PATH as equally valid). A case
  declaring CLAUDE.md in corpusFiles and reading it would always get a false unloaded-file divergence.
  Fixed by extracting isCorpusLayoutPath into corpus-file.ts as the one shared predicate.

- Should-fix (Spec, reproduced with a probe): a real Read tool_use never carries a bare corpus-layout
  path — the session always reads an absolute path (live install ~/.claude/<path>, or an attempt's
  corpus overlay <attemptDirectory>/.claude/<path>). The old filter matched neither shape, so AC#1's
  Read-tool-use path was structurally unreachable against any real transcript, masked by a unit test
  whose input didn't reflect the real record shape. Fixed: observedManifest now recognizes the layout
  path as the suffix after a .claude/ segment, alongside the pre-existing bare-path case.

- Should-fix (Testing, testing axis): skillsInvoked, newly exported from transcript.ts, had no direct
  test of its own, only transitive coverage through context-manifest.test.ts. Added a direct test;
  verified by mutation (deleting the function body) that it now fails where it previously passed.

Notes disposed with no action: Security flagged that transcript-carried skill/style strings reach
persisted manifest paths with no traversal guard and no max length, unlike corpus-file.ts's confinedTo
pattern — traced every consumer (session-attempt.ts, session-record.ts, session-run-command.ts,
staleness-report.ts, list-command.ts), confirmed no filesystem sink exists for these values today, so
left as a note, not fixed. Style noted skillsInvoked re-parses an already-typed ToolUse through a second
zod schema rather than field-sniffing like filesRead does — a consistency observation, not a defect,
left as-is. Spec noted the schema permits divergences without contextManifest (and vice versa) though
the one write site never produces that combination — not worth a schema-level refine for a shape
nothing writes.

Observed directly this session: full suite green before every commit (mise exec -- bun run test:
1192 pass + 99 pass, 0 fail, post-fix), typecheck and lint clean throughout, and a live probe against
both real absolute Read-path shapes (live install and corpus overlay) confirming the fix.

Carries forward: doc-9 gap 3 (rules/ in the corpus layout, project-half context) is ACT-60/ACT-61, not
touched here. No CLI surface prints divergences to an operator yet — the record carries them, nothing
reads them back for display; not asked for by any AC, follow-up if wanted.

Overseeing session verification, 2026-09-08. Observed the manifest working live, not only under test.

Ran the manifest-probe case twice and read the attempt records. A clean run recorded contextManifest.paths [skills/verify/SKILL.md, output-styles/brief.md] with divergences []. Adding skills/shape/SKILL.md to the case's corpusFiles, which the session never loads, produced divergences [{kind: unloaded-file, path: skills/shape/SKILL.md}]. AC#6's behavior confirmed against a real session rather than a fixture.

Probed the prefix-leak fix (commit 33d9841) by re-planting the bug: reverting session-attempt.ts:350 to read the whole transcript instead of transcript.slice(cut) fails 'excludes a skill invoked only in the seeded transcript prefix' on exactly that assertion. The test kills the mutant; the fix is real and guarded. Source restored.

Full check green independently: 1291 tests, lint, typecheck, format.

One gap the build did not surface, filed as ACT-118: a session case's transcript prefix has to exist in two places. The AC#7 test reads it from casesRoot() (cases/<id>/), while the harness at runtime resolves it under .benchmark-runs/cases/<id>/, which is git-ignored. Running manifest-probe from a fresh clone fails with 'no file is at .benchmark-runs/cases/manifest-probe/...' until the prefix is copied across by hand, which is what I did to run it here.
<!-- SECTION:NOTES:END -->
