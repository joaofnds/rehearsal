---
id: ACT-60
title: carry rulebook/ in the corpus layout
status: Build
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 16:57'
labels: []
milestone: m-3
dependencies:
  - ACT-59
documentation:
  - backlog/docs/doc-9 - context-manifest-design.md
priority: medium
ordinal: 57008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CORPUS_LAYOUT_DIRECTORIES in src/benchmark/corpus-file.ts is skills/, agents/,
output-styles/, plus the CLAUDE.md special case. A real session on this
machine also loads ~/.agents/rulebook/ (renamed from rules/ sometime after
2026-09-04; verified 2026-09-08 that ~/.agents/ holds agents, rulebook,
skills, and AGENTS.md routes to rulebook/*.md throughout). It is part of the
engineer's global instruction set and varies with --corpus like every other
corpus kind.

Today a session case cannot declare a rulebook file, so a corpus A/B that
changes a rule measures nothing: the bytes change, no case names them, no
lineage hashes them, no checkpoint goes stale, and ACT-59's context manifest
cannot reconcile a Read of one either, since isCorpusLayoutPath does not
recognize it.

Verified 2026-09-08: src/benchmark/checkpoint.ts already treats rulebook as
solved for pipeline-case stage corpus, under the settled name "rulebook"
(LAYOUT_DIRECTORY_KINDS, checkpoint.ts:198). This card brings session-case
corpus into agreement with that name. The mechanical part: add "rulebook"
to CORPUS_LAYOUT_DIRECTORIES in corpus-file.ts. Every consumer that derives
from that one list picks it up: isCorpusLayoutPath (shared by
resolveCorpusFile and the ACT-59 manifest), corpus-source.ts's
holdsCorpusLayout and corpusLayoutEntries, and hashCorpusFiles.

Reviewed 2026-09-08 and found NOT that simple: two more consumers exist and
do not derive from CORPUS_LAYOUT_DIRECTORIES, so they will not pick the
change up for free and each needs its own look:

- src/server/corpus-report.ts:25-28 already appends "rulebook" itself,
  anticipating this exact gap (its own comment says so): `const
  CORPUS_SCREEN_DIRECTORIES = [...CORPUS_LAYOUT_DIRECTORIES, "rulebook"]`.
  Once "rulebook" joins CORPUS_LAYOUT_DIRECTORIES, this produces the string
  twice, and hashCorpusLayout (corpus-report.ts:77-97) hashes the rulebook
  directory twice into CorpusFileReport.files and its digest. This card
  must remove corpus-report.ts's now-redundant explicit append in the same
  change, not just corpus-file.ts.
- src/benchmark/session-corpus.ts:200 hardcodes its own list,
  `OVERLAID_KINDS = ["output-styles/", "agents/"]`, used by isOverlaid to
  decide which declared corpus files installSessionCorpusSnapshot copies
  into a session attempt's .claude overlay for a directory corpus source
  (--corpus <path>). This list is independent of CORPUS_LAYOUT_DIRECTORIES
  and excludes skills/ on purpose (see refuseDeclaredSkills nearby). Left
  unchanged, a session case that declares a rulebook/ file against a
  directory corpus source would resolve and hash it correctly but never
  have it delivered into the attempt's overlay, so the session would run
  without seeing the declared, hashed file: the exact "measures nothing"
  failure this card exists to close, for the directory-source path
  specifically. This card must add "rulebook/" to OVERLAID_KINDS.

GLOSSARY.md has two entries with the identical omission, not one: "Corpus
layout" (GLOSSARY.md:123-128) and "Corpus layout path" (GLOSSARY.md:129-133)
both enumerate CLAUDE.md, output-styles/, agents/, skills/ and both omit
rulebook/. Both need the fourth kind added.

Note the distinction this card must not blur: rulebook/ is corpus, varying
per corpus arm. The target repository's own instructions and documents are
project context, varying per case, and belong to the project-half card
(ACT-61).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A case can declare a corpus file under rulebook/ and resolveCorpusFile resolves it against the live source and against a directory corpus source
- [ ] #2 A declared rulebook/ file is hashed into the attempt record's corpus digests before any provider call, exercised the same way an agents/ or output-styles/ file already is
- [ ] #3 An edit to a rulebook/ file a checkpoint's captured corpus already covers continues to make that checkpoint stale (regression only: checkpoint.ts's own LAYOUT_DIRECTORY_KINDS is unchanged by this card)
- [ ] #4 A context manifest built from a transcript carrying a Read tool_use on a rulebook/ path (ACT-59's observedManifest) reports that path as a manifest entry, and a case that declares it in corpusFiles without the session reading it reports an unloaded-file divergence
- [ ] #5 A corpus source directory holding only a rulebook/ subdirectory is accepted by resolveCorpusSource rather than refused as holding no layout entry
- [ ] #6 A session case run against a directory corpus source (--corpus <path>) that declares a rulebook/ file gets that file copied into the attempt's .claude overlay, the same way a declared agents/ or output-styles/ file already is
- [ ] #7 GLOSSARY.md's Corpus layout and Corpus layout path entries both list rulebook/<name>.md alongside output-styles/, agents/, and skills/
- [ ] #8 src/server/corpus-report.ts's CorpusFileReport for the live corpus lists each rulebook file exactly once, not twice, once its own explicit rulebook append to CORPUS_SCREEN_DIRECTORIES is removed in favor of CORPUS_LAYOUT_DIRECTORIES carrying it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-08, corrected after independent review the same day.

Goal: bring session-case corpus handling into agreement with the rulebook
precedent checkpoint.ts already settled for pipeline-case stage corpus
(the name "rulebook"), so a rulebook/ file is a declarable, hashable,
stale-detectable, manifest-visible, delivered corpus kind like agents/,
output-styles/, and skills/.

Unknowns and how each resolved:
- Directory name (rules/ vs rulebook/): settled by disk state, not a
  decision. ~/.agents/rules/ no longer exists; verified 2026-09-08 it was
  renamed to rulebook/. checkpoint.ts already committed to "rulebook" as the
  layout kind name (LAYOUT_DIRECTORY_KINDS, checkpoint.ts:198). This card
  reuses that name rather than reopening it.
- Whether adding "rulebook" to CORPUS_LAYOUT_DIRECTORIES alone is
  sufficient: no, disproven by review. A reviewer agent (unprimed, given
  only the shaped card and told to verify the "every consumer picks it up
  for free" claim against the source) found two consumers that do not
  derive from CORPUS_LAYOUT_DIRECTORIES: src/server/corpus-report.ts
  (already appends "rulebook" itself; would double it once the base list
  carries it too, corrupting its file list and digest) and
  src/benchmark/session-corpus.ts's OVERLAID_KINDS (governs what a
  directory corpus source's declared files actually get copied into a
  session attempt's overlay; a declared rulebook/ file would resolve and
  hash but never be delivered to the session). Both are now separate ACs
  (#6, #7) and separate description sections, not folded into "the one
  list."
- Whether rulebook/ is corpus or project context: corpus. It is the
  engineer's global instruction set, varies with --corpus, unlike the
  target repository's own instructions (project half, ACT-61). Backed by
  doc-9's own framing, not re-derived here.

Approach: no removal option applies (the gap is real and named by the
card's own opening paragraph); the mechanism is not a design choice since
checkpoint.ts already set the precedent under the name "rulebook" and three
of the four touch points (corpus-file.ts, corpus-report.ts,
session-corpus.ts) are small, independent, mechanical edits once each is
named. No survey past that.

Glossary: both GLOSSARY.md "Corpus layout" (123-128) and "Corpus layout
path" (129-133) entries omit rulebook/ identically; both need the edit, not
just the one the first draft of this card named.

First test to write: extend corpus-file.test.ts's resolveCorpusFile
it.each table (corpus-file.test.ts:22-29) with a
["rulebook/coding-style.md", join(homedir(), ".claude/rulebook/coding-style.md")]
case, following the existing skills/agents/output-styles pattern exactly.

Carries forward: project-half context (target repo's own CLAUDE.md,
GLOSSARY.md, stage documents) stays out of scope, per doc-9 and ACT-61.
<!-- SECTION:NOTES:END -->
