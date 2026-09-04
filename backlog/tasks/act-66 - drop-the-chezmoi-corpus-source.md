---
id: ACT-66
title: 'load whatever the agent loads, and stop knowing how it got there'
status: To Do
assignee: []
created_date: '2026-09-04 18:16'
updated_date: '2026-09-04 18:20'
labels: []
dependencies: []
priority: high
type: chore
ordinal: 0
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
João, 2026-09-04: it is none of our concern how the dotfiles came to be. We load whatever the agent will load. How it ended up there does not matter.

The harness has one job at this boundary: read the corpus the agent reads. A corpus is a directory in corpus layout. Rehearsal must not know what produced it.

Today it knows. `--corpus` accepts `chezmoi:<ref>`, and the harness runs `git archive` piped through `tar` in a shell, runs `chezmoi apply` against scratch source and destination directories, excludes encrypted files because they block on a passphrase, excludes scripts, resolves the ref to a commit because HEAD names different bytes on different days, quotes shell arguments for that pipeline, guards against a ref git would parse as an option, and discards the render afterward. That is a dotfiles deployment tool living inside a benchmark harness.

It leaks past the render. A second layout table (CHEZMOI_LAYOUT against INSTALLED_LAYOUT) exists because a render is a whole home tree rather than a corpus. A per-kind instructions path exists because the render keeps CLAUDE.md somewhere else. A symlink refusal exists because a render's entries point back at the live install. A kind discriminant is branched on in session-corpus.ts, stale-command.ts, and the session record schema.

88 references across 15 files. About 40 of the 328 lines in corpus-source.ts.

It has never been used. No record under .benchmark-runs carries a chezmoi origin.

The work: delete the source kind. `--corpus` takes a directory in corpus layout and nothing else. Anyone measuring a corpus that lives in a dotfiles ref renders it with their own tools and passes the directory, which is one command outside rehearsal. Check whether removing the discriminant collapses ResolvedCorpusSource to a root plus a provenance label, which would simplify session-record.ts too. Decide explicitly whether a record naming a chezmoi origin must still load; nothing on disk does, so dropping it from the schema and saying so is likely the honest answer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 --corpus accepts a directory in corpus layout and rejects any other form, and no source file under src/ mentions chezmoi
- [ ] #2 ResolvedCorpusSource carries no kind discriminant naming a producing tool
- [ ] #3 A corpus living in a dotfiles ref is still measurable by rendering it outside rehearsal and passing the directory
- [ ] #4 A recorded artifact naming a chezmoi origin still loads, or the schema drops it and the record says why
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction on how this card came to exist, 2026-09-04.

I did not find this. I built on chezmoi and João caught it.

Two of my ACT-41 commits added chezmoi code. 398ae27 added INSTRUCTIONS_SOURCE_PATH, a per-kind map teaching the layout enumerator that a render keeps its instruction file at .claude/CLAUDE.md. ca2f591 then moved that map next to the resolver, because the first change had left resolution and enumeration disagreeing, which broke stale --corpus chezmoi:<ref>. So one of the two defects this card cites as evidence against chezmoi is a defect I introduced while extending it.

The shape document (doc-8) listed criterion 5 as a chezmoi symlink refusal and recorded that refusal as correct and worth keeping. I took the criterion as settled and built to it. I never asked whether the harness should know about chezmoi at all. That question was available at the start of the task, in the same document, and I read past it.

What survives the removal: the deletion in session-corpus.ts copyDeclared, which stopped substituting the control repository's project file for a corpus that carried none. That is the ACT-41 fix and it is independent of the source kind. What dies with chezmoi: the per-kind map, the resolver's use of it, the CHEZMOI_LAYOUT table, and the tests pinning all three, including the two I wrote.

Whoever picks this up should not treat my chezmoi commits as prior art to preserve. Revert direction is cleaner than refactor direction.

Sequencing: ACT-65 touches the same snapshot code (installStageCorpusSnapshot and the frozen CLAUDE.md nothing copies out). Take them together, or this one first, since removing the source kind may change what ACT-65's fix has to handle.
<!-- SECTION:NOTES:END -->
