---
id: ACT-59
title: >-
  observe what an attempt actually loaded and reconcile it against the
  declaration
status: To Do
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 10:33'
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
<!-- SECTION:NOTES:END -->
