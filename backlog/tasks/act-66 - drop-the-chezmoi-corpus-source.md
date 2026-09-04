---
id: ACT-66
title: drop the chezmoi corpus source
status: To Do
assignee: []
created_date: '2026-09-04 18:16'
updated_date: '2026-09-04 18:19'
labels: []
dependencies: []
type: chore
ordinal: 63008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
João, 2026-09-04: chezmoi has nothing to do with rehearsal and we should never have to deal with it.

He is right, and the boundary argument is the case. Rehearsal measures an instruction corpus. A corpus is a directory in corpus layout. How that directory came to exist is not rehearsal's concern, and knowing about chezmoi couples the harness to how one machine's dotfiles happen to be managed.

The directory source already subsumes the chezmoi one. Anything chezmoi:<ref> measures, a caller can produce outside rehearsal and pass as a directory.

What it costs today, measured 2026-09-04. 88 chezmoi references across 15 files. About 40 of the 328 lines in corpus-source.ts are the render and its scaffolding: a git archive piped to tar through sh -c, shell quoting for that pipe, a guard against a ref git would read as an option, an exclusion for encrypted files that block on a passphrase and for scripts, a scratch-directory lifecycle with a discard step, and a rev-parse to record the resolved commit because chezmoi:HEAD names different bytes on different days. Downstream it forces a second layout map (CHEZMOI_LAYOUT against INSTALLED_LAYOUT), a per-kind instructions path, a symlink refusal that exists because a render's .claude entries point back at the live install, and a kind discriminant branched on in session-corpus.ts, stale-command.ts, and the session record schema.

What it has bought: nothing yet. No record under .benchmark-runs carries a chezmoi origin (grep for a chezmoi kind returns none), so the feature has never been used in a real measurement.

Every corpus defect ACT-41 met was a chezmoi defect. The session snapshot silently substituted the control repository's CLAUDE.md for a render that carried none; fixing that exposed a disagreement between resolution and enumeration about where a render keeps the file, which made stale --corpus chezmoi:<ref> refuse a render that has it. Both were fixed, and neither would exist without the source kind.

Sequence this after ACT-65, which touches the same snapshot code, or take the two together. Check whether removing the kind discriminant lets ResolvedCorpusSource collapse to a root and a provenance label, which would simplify session-record.ts too. Decide explicitly whether an old record naming a chezmoi origin must still load; nothing on disk does today, so the honest answer may be to drop it from the schema and say so.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No source file under src/ mentions chezmoi, and --corpus accepts only a directory in corpus layout
- [ ] #2 A corpus variant living in a dotfiles ref is still measurable by rendering it outside rehearsal and passing the directory
- [ ] #3 A recorded artifact carrying a chezmoi origin still loads, or the schema change is recorded as breaking with the reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction on how this card came to exist, 2026-09-04.

I did not find this. I built on chezmoi and João caught it.

Two of my ACT-41 commits added chezmoi code. 398ae27 added INSTRUCTIONS_SOURCE_PATH, a per-kind map teaching the layout enumerator that a render keeps its instruction file at .claude/CLAUDE.md. ca2f591 then moved that map next to the resolver, because the first change had left resolution and enumeration disagreeing, which broke stale --corpus chezmoi:<ref>. So one of the two defects this card cites as evidence against chezmoi is a defect I introduced while extending it.

The shape document (doc-8) listed criterion 5 as a chezmoi symlink refusal and recorded that refusal as correct and worth keeping. I took the criterion as settled and built to it. I never asked whether the harness should know about chezmoi at all. That question was available at the start of the task, in the same document, and I read past it.

What survives the removal: the deletion in session-corpus.ts copyDeclared, which stopped substituting the control repository's project file for a corpus that carried none. That is the ACT-41 fix and it is independent of the source kind. What dies with chezmoi: the per-kind map, the resolver's use of it, the CHEZMOI_LAYOUT table, and the tests pinning all three, including the two I wrote.

Whoever picks this up should not treat my chezmoi commits as prior art to preserve. Revert direction is cleaner than refactor direction.
<!-- SECTION:NOTES:END -->
