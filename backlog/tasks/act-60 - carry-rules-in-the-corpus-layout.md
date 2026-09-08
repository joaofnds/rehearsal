---
id: ACT-60
title: carry rulebook/ in the corpus layout
status: Done
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 17:10'
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
- [x] #1 A case can declare a corpus file under rulebook/ and resolveCorpusFile resolves it against the live source and against a directory corpus source
- [x] #2 A declared rulebook/ file is hashed into the attempt record's corpus digests before any provider call, exercised the same way an agents/ or output-styles/ file already is
- [x] #3 An edit to a rulebook/ file a checkpoint's captured corpus already covers continues to make that checkpoint stale (regression only: checkpoint.ts's own LAYOUT_DIRECTORY_KINDS is unchanged by this card)
- [x] #4 A context manifest built from a transcript carrying a Read tool_use on a rulebook/ path (ACT-59's observedManifest) reports that path as a manifest entry, and a case that declares it in corpusFiles without the session reading it reports an unloaded-file divergence
- [x] #5 A corpus source directory holding only a rulebook/ subdirectory is accepted by resolveCorpusSource rather than refused as holding no layout entry
- [x] #6 A session case run against a directory corpus source (--corpus <path>) that declares a rulebook/ file gets that file copied into the attempt's .claude overlay, the same way a declared agents/ or output-styles/ file already is
- [x] #7 GLOSSARY.md's Corpus layout and Corpus layout path entries both list rulebook/<name>.md alongside output-styles/, agents/, and skills/
- [x] #8 src/server/corpus-report.ts's CorpusFileReport for the live corpus lists each rulebook file exactly once, not twice, once its own explicit rulebook append to CORPUS_SCREEN_DIRECTORIES is removed in favor of CORPUS_LAYOUT_DIRECTORIES carrying it
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All 8 acceptance criteria implemented and verified with a fresh test run this
session (mise exec -- bun run test: 1246 + 100 pass, 0 fail; typecheck, lint,
fmt:check all clean). Commits: 343f8f3 (add rulebook to
CORPUS_LAYOUT_DIRECTORIES), 9153efb (test coverage for hashing/source
acceptance/manifest), 0c7145d (fix corpus-report.ts's double-count once
rulebook joined the base list), 3963a41 (add rulebook/ to session-corpus.ts's
OVERLAID_KINDS so a directory-source overlay actually delivers it),
01c9f2c (regression test proving deriveStaleness still catches a rulebook
edit), 1364e91 (GLOSSARY.md's two layout entries), cbf81a2 (review fixes,
below).

Six-axis code review ran (Spec, Style, Architecture, Security, Testing,
Refactoring), one reviewer per axis, all against the ACT-60 diff
(b85f504..HEAD at review time). Spec confirmed all 8 ACs present, each with
a code path and a pinning test. Security and Testing found nothing.

Two should-fix findings, independently raised by 3-4 of the 6 reviewers,
were fixed in commit cbf81a2: GLOSSARY.md's "Corpus (instruction corpus)"
and "Corpus overlay" entries were left stale/wrong after this task edited
the two sibling "Corpus layout"/"Corpus layout path" entries — "Corpus
overlay" in particular said the overlay carries only output styles and
agent definitions, which the code no longer matches. Also fixed a cosmetic
ordering nit the Style axis noted in corpus-file.ts's refusal message.

Two findings were surfaced and left open, judged pre-existing or deliberate
rather than this task's to fix:
- Refactoring flagged three independent "layout kind" lists (corpus-file.ts's
  CORPUS_LAYOUT_DIRECTORIES, checkpoint.ts's LAYOUT_DIRECTORY_KINDS,
  session-corpus.ts's OVERLAID_KINDS) as duplicated knowledge, should-fix.
  Architecture reviewed the same shape and judged it a deliberate split:
  OVERLAID_KINDS is a genuine subset (skills/ is excluded on purpose, per its
  own doc comment, since a skill can't be overlaid this way until ACT-28),
  and checkpoint.ts is untouched by this card. Worth a follow-up card if a
  future layout kind needs adding to more than one list again.
- checkpoint.ts:117-118's doc comment already omitted rulebook before this
  diff (confirmed via git show b85f504); out of scope since checkpoint.ts
  isn't in this diff's changed-file set.
- No test exercises a nested rulebook subdirectory path (e.g.
  rulebook/testing/00-index.md); Spec reviewer verified manually that the
  existing generic code (recursive cp, prefix-matching declares()) already
  handles it correctly, so this is a coverage gap, not a functional one.

Carries forward: project-half context (the target repository's own
CLAUDE.md, GLOSSARY.md, stage documents) stays out of scope per doc-9 and
ACT-61, unchanged by this card.
<!-- SECTION:FINAL_SUMMARY:END -->
