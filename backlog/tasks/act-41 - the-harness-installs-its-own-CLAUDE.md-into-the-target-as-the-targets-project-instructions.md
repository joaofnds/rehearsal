---
id: ACT-41
title: >-
  the harness installs its own CLAUDE.md into the target as the target's project
  instructions
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 02:13'
updated_date: '2026-09-04 17:48'
labels: []
milestone: m-1
dependencies: []
documentation:
  - backlog/docs/doc-8 - shape-ACT-41-project-instructions.md
priority: high
ordinal: 43008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/benchmark/config.ts defines PROJECT_INSTRUCTIONS_PATH as the control repository's own CLAUDE.md, and src/benchmark/backlog.ts installInstructions writes it into the target repository and commits it. For any case whose target is a different project, the agent is handed instructions describing the wrong codebase.

Observed 2026-09-04 in the first real pipeline run (ACT-38, record .benchmark-runs/2026-09-04T02-09-23.870Z.shape.json). The shape agent, working in the NestJS/MikroORM/BullMQ/Postgres template, received rehearsal's CLAUDE.md, which says 'TypeScript on Bun. No framework, no database, no server.' It reported the contradiction in its completion message, shaped the task from the real code instead, and asked whether to open a card to fix the file. The judge then counted that question against it as an open question at completion.

So the agent behaved correctly and lost grade for the harness's defect.

The config comment calls the file 'the project instructions under evaluation... corpus, not case'. That is coherent when the target IS the control repository, and wrong when a case declares its own target. A pipeline case names its target; its project instructions are a property of that target, not of the harness.

This invalidates any pipeline-case score against a target that is not this repository, which is every pipeline case the tool is meant to serve.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A run against the audit-log case adds no CLAUDE.md to the target tree and creates no 'chore: configure project instructions' commit
- [x] #2 A stage's recorded corpus hashes the bytes of the live corpus root's CLAUDE.md, not the control repository's project file
- [x] #3 run and replay against a corpus source holding no CLAUDE.md refuse before any provider call, naming the resolved path
- [x] #4 resolveCorpusFile returns a path under the source root for layout path CLAUDE.md for every source kind, with no live special case
- [x] #5 A session case declaring CLAUDE.md against a chezmoi source is refused as a symlink rather than silently reading the live install
- [x] #6 The audit-log case is re-run and its shape agent reports no contradiction between the instructions and the codebase, and asks no question about the instruction file at completion
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-04. Document: backlog/docs/doc-8 - shape-ACT-41-project-instructions.md

Goal: a pipeline stage session reads the corpus's global instructions and the target's own project instructions, and the harness writes its project file into no target.

The card's premise was wrong on one point, and it changes the work. Criterion #3 asked how to preserve the corpus-under-evaluation meaning of the control repository's CLAUDE.md. That file was never the corpus. The corpus is the global instruction set, and its CLAUDE.md already exists at the live corpus root, where every other corpus kind (skills, agents, output styles) is already resolved from. Observed 2026-09-04: 'ls -la ~/.claude/CLAUDE.md' shows a symlink to ~/.agents/AGENTS.md, 10498 bytes, opening '# Working with João'; the control repository's own CLAUDE.md is 2917 bytes, opening '# Project Core Guidelines'. GLOSSARY.md:81 and docs/vision.md:36 both class CLAUDE.md as the global tier. 'git log -S' shows PROJECT_INSTRUCTIONS_PATH introduced by 116f8f7, a refactor whose body says it only collapsed four sites that each built join(CONTROL_DIR, "CLAUDE.md"); no commit argues for the choice it preserved. So criterion #3 dissolved and is not in the new list.

The real defect: one 'instructions' string carries two meanings through the harness, the corpus file being graded and the project instructions installed into the target. It reaches three jobs: installed into the target (run.ts:866 -> backlog.ts:124 installInstructions, same via replay-command.ts:216), hashed into stage-corpus lineage (checkpoint.ts:187), and offered as calibrate's edit target (calibration.ts:456). The last two are corpus jobs, correct in intent and wrong in which file they read. The first is not a corpus job and should not exist.

Approach chosen: point the corpus at the live root and install nothing into any target. The special cases at corpus-file.ts:53 and session-corpus.ts:174 go away with it. Rejected: sourcing installInstructions from the target's own file (a no-op that rewrites a file with itself, and the audit-log target has neither CLAUDE.md nor AGENTS.md, verified 2026-09-04), and letting a case declare its target's instructions (additive on top of this if a case ever needs it).

Decision for criterion #2, recorded as it asks: a run against a target that declares no project instructions proceeds without installing any. The harness installs nothing into any target. The target's project instructions are a property of the target, and a benchmark that rewrites them measures a repository that does not exist. What is refused instead is a missing corpus CLAUDE.md, before any provider call, the way stale already does at staleness-report.ts:128.

Glossary term to add: Project instructions, the instruction file a repository carries in its own tree for agents working in it, a property of the repository, never installed by the harness, distinct from the corpus's global CLAUDE.md. The existing Corpus entry stays as written.

First test to write: corpus-file.test.ts, resolveCorpusFile with a live source and layout path CLAUDE.md returns join(liveCorpusRoot(), "CLAUDE.md"). It fails today, returning the control repository's path.

Built 2026-09-04. Six commits, a1c610f through 560d788.

What changed. resolveCorpusFile resolves layout path CLAUDE.md under the source root for every source kind; the live special case is gone. A chezmoi render's own .claude/CLAUDE.md is now listed as a corpus entry, so the existing symlink refusal answers for it instead of the snapshot silently substituting the control repository's file. readCorpusInstructions is the one place the corpus instructions are read, with the missing-file refusal staleness-report used to own alone; liveCorpusInstructions wraps it for the commands that take no --corpus. run, replay, and calibrate now read that file rather than the control repository's, so stage lineage hashes the installed CLAUDE.md and calibrate names it as the edit target. installInstructions is deleted: no target gets a CLAUDE.md or a 'chore: configure project instructions' commit, and the task and replay base SHAs come from target.ts currentSha, the checkout's HEAD.

Observed directly, 2026-09-04. createTaskCommit driven against a clone of the real audit-log target (../nest/template): no CLAUDE.md in the tree, git log unchanged at 102e39b, taskSha equal to the target's own HEAD. captureStageCorpus against the live roots records CLAUDE.md sha c2c60cf..., equal to ~/.claude/CLAUDE.md and different from the control repository's e254602.... 'rehearsal stale --corpus <dir without CLAUDE.md>' prints 'Corpus file CLAUDE.md does not exist at /tmp/corpus-no-claude/CLAUDE.md'. liveCorpusInstructions under a HOME with no .claude throws CorpusFileError naming the resolved path, which is the refusal run and replay reach before any provider call.

Checks. bun test 1034 pass 0 fail, lint and typecheck clean over src. fmt:check reports three files under docs/design-handoff/, vendored and unformatted before this task; verified failing at 946919a.

Not verified. Criterion #6 is unchecked: it needs a paid pipeline run of the audit-log case and the shape agent's completion message. Nothing in this task exercised a provider.

Found on the way. Two pre-existing tests in target.test.ts failed at baseline because the fixture repository tracked no .gitignore, so a test writing under backlog/ read as a dirty target; fixed in ed555f3 by moving the .gitignore five call sites wrote by hand into the fixture's base commit.

Filed. ACT-63: stageCorpusRoots and both command sites still search corpusLayoutRoots(CONTROL_DIR), the same control-root assumption one layer down. Latent only, because rehearsal has no .claude directory today.

Criterion #6 closed 2026-09-04 by a real run: .benchmark-runs/2026-09-04T17-34-35.900Z.shape.json, audit-log case against ../nest/template, sonnet at medium effort, opus judge, $4 session budget, matching the settings of the run that first exposed the defect. Stage cost $0.53 across two provider calls.

The fix is confirmed end to end. The instructions the shape agent received open '# Working with João' at 10490 bytes, the global corpus file, where the earlier run fed it '# Project Core Guidelines', this repository's own project file. Its completion message contains none of 'CLAUDE.md', 'contradiction', 'different project', 'misleading', or 'instruction', and asks zero questions. The earlier run's message had reported the file 'describes an entirely different project' and asked whether to open a card about it. The target ended clean at 102e39b with no CLAUDE.md and no 'chore: configure project instructions' commit, which is criterion #1 observed in a real run rather than at the unit.

The stage still graded F, on a different and unrelated blocker. The harness reported 'Target baseline changed unexpectedly': the agent bypassed the backlog CLI, wrote the card file directly, and momentarily wiped its frontmatter before restoring it. That is a corpus finding about the board skill, filed as ACT-64. It does not bear on this card, whose criterion is about what the agent read and what it asked, both now correct.

Independent review, 2026-09-04, one round, fresh reviewer given the diff and the acceptance observations only.

Disposed by fixing, in ca2f591. Resolution and enumeration disagreed about where a chezmoi source keeps CLAUDE.md: listing the render's .claude/CLAUDE.md as an entry left resolveCorpusFile looking at the root, so 'stale --corpus chezmoi:<ref>' refused a render that holds the file. Verified before and after with a probe over an unsnapshotted render. Both now read one map, which moved to corpus-file with liveCorpusRoot, breaking the import cycle that move would otherwise have created. Also fixed: createTaskCommit renamed seedTaskBoard, since it writes no commit and its name and new comment both claimed one; the base-commit read in replay-confirmation given its own setupOperation label, so a failure there is not reported as checkpoint materialization; the hashCorpusFiles test moved onto a directory source, so it no longer depends on this machine's install; the liveCorpusInstructions test replaced, having compared a value against itself and so unable to fail on a regression. Suite 1035 pass, lint and typecheck clean.

Disposed by filing, ACT-65. A confirmed replay hashes frozen.instructions into its record while the session reads the live file, because installStageCorpusSnapshot never copied CLAUDE.md out of the snapshot and installInstructions had been masking that. Real, and this change exposed it. Not fixed here: the fix needs a fact nobody has verified, whether a project-level .claude/CLAUDE.md is loaded at all on the current claude version, and a decision about how a frozen corpus delivers its instructions. Debug replay is unaffected.

Disposed as accepted, no action. Symlink following in readCorpusInstructions and the undelivered CLAUDE.md for a directory-source session case are both pre-existing and byte-identical to what they replaced; the reviewer confirmed the change neither introduces nor worsens either. The fixture's new .gitignore reaching baseline context is intended and its consequence is recorded in checks.test.ts.

On observation #3 the reviewer is right that the cited test exercises readCorpusInstructions against a directory source rather than run or replay. Both commands refuse --corpus, so the only corpus they can meet is a live install missing the file, and the refusal precedes any provider call at both sites. I observed that directly earlier with an empty HOME. The behavior holds; the test does not demonstrate it at the level the criterion states.
<!-- SECTION:NOTES:END -->
