---
id: ACT-26
title: give rehearsal one CLI that agents and humans drive alike
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
  - docs/vision.md
  - docs/design.md
type: feature
ordinal: 21008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Direction from João, 2026-09-02: agents editing his instruction corpus keep building bespoke evals (dotfiles doc-3 and doc-4, the clean-room brief-split study, the deleted instructions-reviewer known-answer cases) as scripts and prose, then use them to tune the corpus. That is rehearsal's use case. Rehearsal needs a CLI an agent can use to set up cases, run and confirm them, read results, and calibrate, covering what a human does at the terminal today, so sessions stop writing scripts and use the tool.

The exploration record is backlog/docs/doc-1: the jobs a session has, the four harnesses agents built and what each needed, the seven gaps that kept them off rehearsal (one hardcoded case; only the pipeline case kind; the corpus under test is the live install; three prompts with no non-interactive path; no help, list, or show; human text only; three entry points with three flag dialects), what already exists to build on, prior art (promptfoo, Inspect AI, agent-CLI checklists), the proposed surface, and the decisions taken.

Children, in the recommended order: ACT-26.4 cases as data, ACT-26.5 the session case kind (ACT-25 waits on it), ACT-26.6 corpus variants from a source; then ACT-26.1 one entry point with help, JSON, and exit codes, ACT-26.2 list, show, and stale, ACT-26.3 review and calibrate without a paused process. The first three replace the scripts; the last three replace the terminal touchpoints.

Open for João, with recommendations, in doc-1: (1) whether a case run sees a copy of the live config with only the files under test replaced (recommended) or a scratch config; (2) whether transcript bytes for session cases stay git-ignored and hashed like checkpoints (recommended) or are committed.
<!-- SECTION:DESCRIPTION:END -->
