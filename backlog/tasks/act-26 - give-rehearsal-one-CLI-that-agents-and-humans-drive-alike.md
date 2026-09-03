---
id: ACT-26
title: give rehearsal one CLI that agents and humans drive alike
status: Done
assignee: []
created_date: '2026-09-02 15:14'
updated_date: '2026-09-03 04:49'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
João decided 2026-09-02: a case run sees a copy of the live config with only the files under test replaced; session-case transcript bytes stay git-ignored and hashed into lineage, only the case declaration is committed. Both recorded in doc-1.

Spend: 0.086929 USD after ACT-26.5

Spend: 0.32 USD after ACT-26.6

Spend: 0.45 USD after ACT-26.3 Build (0.13 USD: two sealed stage-Judge rejudge calls on frozen evidence, sonnet, observing calibrate's refusal without --confirm-rejudge and its COMPLETE artifact with it)

Spend: 2.91 USD after ACT-25 Build (2.456045 USD: one debug session attempt of brief-reply-92b2e8b0, opus/high, the re-check of whether the provider honors a settings overlay on --resume; three further turns skipped on the dispatch's stop condition)

Spend: 5.37 USD at close (adds the orchestrator's control run of the 92b2e8b0 turn with settings removed, 2.455190 USD opus/high, which settled that the provider does honor a settings overlay on --resume; plus two smoke verification runs at 0.016883 USD each). Against a 50 USD ceiling.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One executable, rehearsal, with eleven commands an agent can drive: run, replay, review, calibrate, compare, list, show, stale, case list, case show, case capture. Every command has --help generated from a declarative flag table, --json printing the same zod-validated record it wrote, stdout for data and stderr for diagnostics, and four exit codes with one meaning each. No command prompts without a flag alternative.

What exists now, per card. ACT-26.1 replaced three scripts with one entry point. ACT-26.4 made benchmark cases data under cases/<id>/case.json, stamped caseId onto every record, and kept every record already on disk readable. ACT-26.5 added the session case kind: a prompt or a resumed transcript judged by deterministic checks, with case capture streaming a transcript prefix into a case's store. ACT-26.6 added --corpus, taking a directory or a chezmoi ref rendered into a scratch destination, snapshotted into the run's own directory so nothing live is touched. ACT-26.2 added list, show, and stale over typed record ids that show accepts back. ACT-26.3 made the review pause a flag, so a run records its evidence, pins the candidate, restores the target, and exits, with review and calibrate driving the rest. ACT-25 declared four brief-reply cases from real transcripts.

Every card took Shape, Build, and an independent review. Fourteen blocking defects were found and fixed across the seven reviews, plus roughly fifty should-fix defects. The ones worth naming: --json truncated at 128 KB through a pipe, corrupting every artifact an agent would parse; session cleanup deleted an unrelated transcript chosen by sort order and recorded it as evidence; a crafted --corpus ref truncated any writable file to zero bytes; calibrate could not read the stopped-stage record a real run writes; a declared transcript path escaped its directory with its digest unverified; and three tests asserted counts against a gitignored directory, so trunk did not build on a fresh clone.

Decided autonomously, and reversible. The mechanism for João's corpus decision was replaced: he chose a copy of the live config with only the files under test swapped, and a copied config is logged out, verified twice, so the variant is delivered as overlays inside the attempt directory while hooks, memory, and MCP stay live. Recorded on ACT-26.6 and in doc-1. The backtick check the planning document specified for ACT-25 was dropped, because the live style forbids only the em dash and João's own accepted reply contains a backtick. ACT-25's agent-dispatch and sent-equals-return checks were not built, their mechanism having been reverted from dotfiles the day the card was filed. Each card's own "Decided autonomously" section holds the rest.

Not built, with triggers on their cards: a session confirmation group, which refuses rather than pretending; skills in a corpus source, which wait on ACT-28; a CLAUDE_CONFIG_DIR copy mode, which needs a persistent logged-in scratch config; a control arm for the brief style, one declaration away.

Not observed: the no-pause run path end to end and any full pipeline run, both needing a full pipeline of paid sessions projected past the ceiling; three of the four brief-reply turns, about 7 USD; a chezmoi ref other than HEAD end to end.

Seven follow-on cards were filed from evidence: ACT-26.7, ACT-27, ACT-28, ACT-29, ACT-30, ACT-31, ACT-32, ACT-33. ACT-28 is the one to read first: a project-level skill does not shadow a user-level one, so every confirmation rep and replay that installed a corpus snapshot ran against the live skills while recording the frozen bytes in lineage.

Total spend 5.37 USD against a 50 USD ceiling. 164 commits on main, unpushed. Trunk builds on a fresh clone except five pre-existing failures carried by ACT-30 and by ACT-26.4's target test, which depends on a repository outside this one.
<!-- SECTION:FINAL_SUMMARY:END -->
