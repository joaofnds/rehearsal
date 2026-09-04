---
id: ACT-66
title: 'load whatever the agent loads, and stop knowing how it got there'
status: Build
assignee:
  - '@claude'
created_date: '2026-09-04 18:16'
updated_date: '2026-09-04 18:24'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-10 - shape-ACT-66-drop-chezmoi-corpus-source.md
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
- [ ] #5 rehearsal run --corpus chezmoi:HEAD exits 2 with a message naming chezmoi:HEAD and saying a corpus source is a directory in corpus layout
- [ ] #6 grep -ri chezmoi src/ returns nothing
- [ ] #7 ResolvedCorpusSource is the union live | directory, and no member names a producing tool
- [ ] #8 corpusLayoutEntries over a fixture holding both .agents/skills/x and skills/x enumerates only skills/x, and over a fixture holding only .claude/CLAUDE.md enumerates no CLAUDE.md entry
- [ ] #9 A session attempt record carrying corpusOrigin {kind: chezmoi, ref, commit} is refused by the schema, and a record carrying no corpusOrigin field still loads
- [ ] #10 refuseSymlinks still throws on a symlinked entry under a directory source, asserted by a test that survives the removal
- [ ] #11 grep -ri chezmoi README.md GLOSSARY.md returns nothing, and both still describe --corpus as taking a directory in corpus layout
- [ ] #12 bun test, bun run typecheck, bun run lint, and bun run fmt:check all pass
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

---

Shaped 2026-09-04. Full reasoning in doc-10; the card below is what the build needs.

Goal: --corpus takes a directory in corpus layout and nothing else, so the harness reads a corpus without knowing what produced it.

Unknowns, all resolved from the repository rather than from João:

- Does the discriminant collapse to a root plus a provenance label? No. `live` carries behavior `directory` does not, in four places: snapshotSessionCorpus names the live root instead of copying it, installSessionCorpusSnapshot overlays nothing for it, stageCorpusRoots searches the project-then-user pair only for it, and resolveCorpusSource(undefined) produces it. ResolvedCorpusSource becomes the two-member union live | directory. That satisfies criterion 2: no member names a producing tool. Collapsing further would push the live/copied distinction into every caller.
- Must a record naming a chezmoi origin still load? No, and the schema drops it. Verified over every .benchmark-runs/sessions/*/*/attempt.json on 2026-09-04 at e48a660: two records carry corpusOrigin {"kind":"live"}, the rest carry no corpusOrigin field at all, and nothing under .benchmark-runs mentions chezmoi. corpusOrigin is already .optional(), so the pre-field records keep loading. Preserving a parse path for a record that has never existed would be carrying a fiction.
- Does INSTRUCTIONS_SOURCE_PATH survive? No. With chezmoi gone, live and directory both map CLAUDE.md to CLAUDE.md, so the per-kind map added by 398ae27 becomes a constant and resolveCorpusFile reads CORPUS_INSTRUCTIONS_PATH directly. CHEZMOI_LAYOUT dies; INSTALLED_LAYOUT becomes the only table.
- Does the symlink refusal survive? Yes, refuseSymlinks stays. A directory a user renders with their own tools can hold symlinks just as a render did, and dereferencing one snapshots bytes from outside the corpus while the record claims otherwise. Only the comment naming chezmoi as the reason changes. Criterion 6 pins it.
- Is the constraint this card overturns measured? Yes. doc-8 recorded the chezmoi symlink refusal as correct and worth keeping, and ACT-26.6 shipped the source. What overturns it is the disk, not a cost prediction: the feature has no recorded use, and the same corpus is reachable by rendering outside rehearsal and passing the directory.

Approach: revert direction, not refactor direction. Delete the chezmoi member and everything that serves only it, then let the type checker find the callers. It will not find tests that assert a chezmoi string is accepted, so delete those rather than repoint them, and it will not find the README and GLOSSARY prose, which is why criterion 7 exists.

Dropped criterion: the original criterion 3 (a corpus in a dotfiles ref is still measurable by rendering it outside rehearsal) is not a behavior of this code and cannot be observed against it. It is the design rationale, kept in doc-10.

First test to write: resolveCorpusSource("chezmoi:HEAD") rejects with a CorpusSourceError naming the source and saying a corpus source is a directory. It fails today because it resolves. The remaining four are listed in doc-10.

Scale, run 2026-09-04 at e48a660: `grep -rio chezmoi --include='*.ts' src/ | wc -l` gives 104 across 15 files; the card's description says 88, which grew with the ACT-41 commits its own notes describe. src/benchmark/corpus-source.ts is 328 lines and loses roughly 120. CorpusSourceDependencies disappears with its runCommand and dotfilesDirectory, which changes resolveCorpusSource's signature and the stale command's corpusSource dependency slot. That is the largest ripple and it is mechanical.

Glossary: three entries name chezmoi (Corpus snapshot origin, Corpus source, Corpus variant) and all three are edited rather than deleted. No new term: this card removes a concept.

Sequencing: do this before ACT-65, as the description says. ACT-65 turns on where a stage session reads project instructions from, and collapsing INSTRUCTIONS_SOURCE_PATH to a constant removes one variable from that investigation. No dependency either way.
<!-- SECTION:NOTES:END -->
