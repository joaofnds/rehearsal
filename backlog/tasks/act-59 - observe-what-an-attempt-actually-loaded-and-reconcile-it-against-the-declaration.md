---
id: ACT-59
title: >-
  observe what an attempt actually loaded and reconcile it against the
  declaration
status: To Do
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 11:23'
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
- [ ] #1 An attempt record carries the context manifest observed from its transcript: the output style in force, the skills invoked, and the files read
- [ ] #2 An attempt whose session loaded a corpus file the case did not declare is reported as a divergence, naming the undeclared file
- [ ] #3 An attempt whose case declared a corpus file the session never loaded is reported as a divergence, naming the unloaded file
- [ ] #4 The manifest is built from records already on disk and needs no provider call, shown by a test over a committed transcript fixture
- [ ] #5 A transcript record type the parser does not recognize yields no manifest entry rather than a failed attempt
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
<!-- SECTION:NOTES:END -->
