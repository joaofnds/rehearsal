---
id: doc-66
title: Triage rehearsal recovery 5
type: other
created_date: '2026-09-09 16:22'
updated_date: '2026-09-09 16:23'
---
# Triage recovery, 2026-09-09

Parent: doc-61. Full before/after fields, including previous verdict text. Every mutation was preceded by a fresh task-view (schemaVersion 1). Existing notes outside the prior verdict paragraph were preserved.

```json
[
  {
    "operation": "edit",
    "id": "ACT-112",
    "evidence": "comparison-attribution.ts dedupedByPath keeps the first hash; all five focused tests use internally consistent hashes.",
    "before": {
      "description": null,
      "implementationNotes": "Found during ACT-50's code review (Testing and Refactoring axes, both rated note/should-fix-adjacent, not blocking). src/server/comparison-attribution.ts's dedupedByPath keeps the first-seen hash per layout path within one arm's own executedCorpus and silently drops any later, differing hash for that same path. This means an arm whose corpus was edited between two of its own stages (a real possibility: snapshotStageCorpus reads live from disk per stage, and staleness-report.ts's deriveStaleness exists elsewhere to detect exactly this kind of mid-run drift) reports based on an arbitrary one of the two hashes, with no signal that the arm's own corpus was unstable. No test exercises this case; all four existing tests in comparison-attribution.test.ts use identical hashes per path within each side. Whether the right behavior is to refuse the attribution claim entirely, surface a distinct warning, or something else, is a product call this card does not make on its own.\n\nTriage 2026-09-08 (e): citation drift only. comparison-attribution.test.ts now has five it() tests, not four as the card states. Substance unchanged: all use identical hashes per path within each side; the differing-hash-within-one-arm case is still untested.\n\nTriage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority set Low this run, from unprioritized.\n\nPart of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.\n\nProbed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.\n\nLow, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand."
    },
    "after": {
      "description": "Refuse or explicitly qualify attribution when one arm records multiple hashes for the same corpus path across stages.",
      "implementationNotes": "Found during ACT-50's code review (Testing and Refactoring axes, both rated note/should-fix-adjacent, not blocking). src/server/comparison-attribution.ts's dedupedByPath keeps the first-seen hash per layout path within one arm's own executedCorpus and silently drops any later, differing hash for that same path. This means an arm whose corpus was edited between two of its own stages (a real possibility: snapshotStageCorpus reads live from disk per stage, and staleness-report.ts's deriveStaleness exists elsewhere to detect exactly this kind of mid-run drift) reports based on an arbitrary one of the two hashes, with no signal that the arm's own corpus was unstable. No test exercises this case; all four existing tests in comparison-attribution.test.ts use identical hashes per path within each side. Whether the right behavior is to refuse the attribution claim entirely, surface a distinct warning, or something else, is a product call this card does not make on its own.\n\nTriage 2026-09-08 (e): citation drift only. comparison-attribution.test.ts now has five it() tests, not four as the card states. Substance unchanged: all use identical hashes per path within each side; the differing-hash-within-one-arm case is still untested.\n\nPart of the backend-gap block filed from doc-47: record fields the UI design calls for that the harness does not yet produce. doc-54 named this block as the largest unverified group on the board and said the next sweep should spend its checking budget here. This run did that.\n\nProbed this run rather than read off the card: the block's subjects are genuinely absent from src/. Greps for the checkpoint id form 'ckpt-', for wordCount, and for median return nothing outside tests, and no per-step contribution phrase or version-distance staleness exists. So these cards describe real gaps and none is secretly done.\n\nLow, and the reason is timing rather than value. Each one feeds a UI surface, and the goal's order (doc-6, doc-7) puts the remaining UI milestones after the corpus containment work now holding every High. None of them is a defect: the harness is correct without them, it is less informative. They become Medium when the screen that consumes the field is the work in hand.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: defer; next action: shaping. Priority: low. Silent first-hash-wins can make attribution confident over unstable evidence, but the desired product behavior is not settled.\n\nEvidence: comparison-attribution.ts dedupedByPath keeps the first hash; all five focused tests use internally consistent hashes.\n\nUnresolved claims/resources: Refuse-versus-warning behavior is unset.\n\nNext action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Choose a distinct refusal naming the unstable arm/path, then add the differing-hash-within-one-arm test.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-114",
    "evidence": ".benchmark-runs/comparisons is empty and no comparison manifest exists. ACT-39 manually compared one replay pair; full compare was split to ACT-69.",
    "before": {
      "description": null,
      "milestone": null,
      "dependencies": [],
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "The comparison screen is opened in a browser against a comparison recorded on disk, not a fixture, and the arm bands, case rows, contrast columns and attribution card are confirmed to render from it (source: ACT-50's reflection, doc-37; verified 2026-09-08 that .benchmark-runs/comparisons is empty, so every check on that screen so far used fixtures or the not-found path)",
          "checked": false
        },
        {
          "index": 2,
          "text": "Why no comparison record exists on this checkout is settled and written down, given ACT-39 is Done and records one (source: doc-37 names this as worth chasing before it is carried forward silently)",
          "checked": false
        }
      ],
      "implementationNotes": "Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action investigation. Priority Medium, unchanged.\n\nThe card's premise is confirmed by direct inspection this run, which prior runs had only inferred: .benchmark-runs/comparisons/ exists and is empty. So no comparison record exists on this checkout, and the screen has never had one to render. That is AC#2's question and it now has evidence behind it rather than an assumption.\n\nConsequence for ACT-50: its AC#14 asks for the What moved tab observed in a browser against a recorded comparison, and no such record exists, so AC#14 cannot be checked until this card produces one. Recorded on ACT-50 as well. No dependency added, because ACT-50's other criterion can be built without a record and only its observation waits."
    },
    "after": {
      "description": "Open the comparison UI against a report produced by the real comparison command and verify every principal region renders from disk evidence.",
      "milestone": "m-7",
      "dependencies": [
        "ACT-69"
      ],
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "The comparison screen is opened in a browser against a comparison recorded on disk, not a fixture, and the arm bands, case rows, contrast columns and attribution card are confirmed to render from it (source: ACT-50's reflection, doc-37; verified 2026-09-08 that .benchmark-runs/comparisons is empty, so every check on that screen so far used fixtures or the not-found path)",
          "checked": false
        },
        {
          "index": 2,
          "text": "The reason this checkout lacks a comparison report is recorded from the completed ACT-39 record and current group/report inventory, with the remaining producer/reader prerequisites named (doc-37 investigation request; ACT-69 and doc-61 verification)",
          "checked": true
        }
      ],
      "implementationNotes": "The card's premise is confirmed by direct inspection this run, which prior runs had only inferred: .benchmark-runs/comparisons/ exists and is empty. So no comparison record exists on this checkout, and the screen has never had one to render. That is AC#2's question and it now has evidence behind it rather than an assumption.\n\nConsequence for ACT-50: its AC#14 asks for the What moved tab observed in a browser against a recorded comparison, and no such record exists, so AC#14 cannot be checked until this card produces one. Recorded on ACT-50 as well. No dependency added, because ACT-50's other criterion can be built without a record and only its observation waits.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\nSettled investigation: ACT-39 compared one replay pair by reading the records and split full report production to ACT-69. Current list groups/list comparisons are empty. ACT-69 now waits on ACT-140 and ACT-151; browser verification waits for its actual report. AC#2 is checked on this evidence.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: implementation. Priority: medium. A real-record browser smoke test is required for m-7, but the evidence it needs does not exist on this checkout.\n\nEvidence: .benchmark-runs/comparisons is empty and no comparison manifest exists. ACT-39 manually compared one replay pair; full compare was split to ACT-69.\n\nUnresolved claims/resources: ACT-69 or equivalent real three-arm, multi-case comparison evidence.\n\nNext action: Wait for ACT-69. Then Add ACT-69 as dependency and replace AC2 with the settled history; once a report exists, run the browser acceptance.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-123",
    "evidence": "StageTranscript stores parsed exchanges/sessionId only; raw JSONL copying exists in session-attempt.ts and not in workflow.ts, run.ts, or checkpoint.ts.",
    "before": {
      "description": "Filed from ACT-61's shaping session, 2026-09-08. A session-case attempt's raw\nClaude session transcript is copied out of the projects directory into the\nattempt record (session-attempt.ts:315-318, recordAttempt), which is what lets\nACT-59's observedManifest parse it for Read/Skill/output-style records.\n\nA pipeline stage session has no equivalent. Verified directly: StageTranscript\n(contracts.ts:243-249) carries only the parsed exchanges a stage turn produced,\nnever the raw .jsonl. workflow.ts's runWorkflowStage reads each turn's\nstructured envelope and pushes it into exchanges; the session id is kept\n(sessionId field) but nothing uses it to locate or copy the underlying\ntranscript file Claude Code writes under its own projects directory. No\n.jsonl handling exists anywhere in workflow.ts, run.ts, or checkpoint.ts\n(grep confirms zero hits).\n\nConsequence: \"observed from transcript\" is structurally unreachable for a\npipeline stage today, so ACT-61's context-manifest work (session-case\nattempts only) cannot cover \"the documents a stage reads off a card,\" the\nthird bullet of its own card description, without this capture existing\nfirst. This card is that prerequisite: capture a stage session's raw\ntranscript the way session-attempt.ts already does, so a later card can\nextend context-manifest.ts's observation to pipeline-stage attempts.\n\nNot scoped here: what the pipeline-stage manifest itself reports once the\ntranscript is capturable — that is downstream work, filed separately once\nthis lands.",
      "priority": "medium",
      "acceptanceCriteria": [],
      "implementationNotes": null
    },
    "after": {
      "description": "Preserve a pipeline stage session’s raw transcript as run evidence so a later pipeline context manifest can observe actual reads. StageTranscript currently retains parsed exchanges/sessionId; runWorkflowStage does not retain raw JSONL. Session attempts already retain it in recordAttempt. This card provides capture, evidence location and an explicit unavailable state; downstream pipeline-manifest presentation remains later work, as ACT-61’s shaping record specifies.",
      "priority": "low",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "A completed pipeline stage retains its available raw session transcript with a location reachable from the stage/run evidence (ACT-61 shaping gap and ACT-123 original capture request; existing session recordAttempt capture behavior)",
          "checked": false
        },
        {
          "index": 2,
          "text": "A stage whose provider supplies no raw transcript records that evidence as unavailable rather than claiming its parsed exchanges are the raw transcript (ACT-61 observed-manifest requirement; current StageTranscript limitation recorded on ACT-123)",
          "checked": false
        }
      ],
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: defer; next action: shaping. Priority: low. Raw pipeline transcripts enable observed context, but the card has no acceptance criteria, retention contract, or downstream pipeline-manifest owner.\n\nEvidence: StageTranscript stores parsed exchanges/sessionId only; raw JSONL copying exists in session-attempt.ts and not in workflow.ts, run.ts, or checkpoint.ts.\n\nUnresolved claims/resources: Destination, immutability, retention, failure handling, and consuming outcome are unset.\n\nNext action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Write observable capture/cleanup acceptance and identify or file the pipeline observed-manifest consumer before build.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-133",
    "evidence": "Current path containment hashes hardlink bytes; a hardlink is another in-root directory entry for the same inode. No third-party corpus intake is in scope.",
    "before": {
      "description": null,
      "implementationNotes": "Found by the security, architecture, and spec reviewers on ACT-132 and reproduced\ndirectly by the iterating session at 7af4465.\n\nACT-132's guard is containment of the fully resolved path. A hardlink resolves\nto a path inside the root, because it is a second directory entry for the same\ninode rather than a reference to another path, so realpath reports it as\ncontained and the bytes are read. No path-based check can see this; ACT-132's\nmechanism is as strong as a path-based guard can be, and closing this needs a\ndifferent one, most likely comparing st_dev/st_ino or refusing an entry whose\nlink count exceeds one.\n\nReproduction at 7af4465: a corpus root whose CLAUDE.md is 'ln' (not 'ln -s') to\nan outside file. readCorpusInstructions({kind:'directory',root}) returned\n'HARDLINK SECRET\\n', the outside file's text.\n\nWeigh the cost before building: refusing every multiply-linked file would refuse\na corpus that legitimately hardlinks within itself, and a case corpus arrives as\ndata an author controls, so the threat is a case author rather than a remote\nattacker. Whether this is worth closing at all is the first question the card\nshould answer.\n\nTriage 2026-09-09: priority Low, and it stays a card rather than being archived.\n\nIts own notes ask the right first question, whether this is worth closing at all. Triage's answer is that it is worth keeping open and not worth scheduling, for three reasons taken together: no path-based guard can see a hardlink, so closing it means a different mechanism (st_dev/st_ino comparison or refusing link counts above one); refusing every multiply-linked file would refuse a legitimate corpus that hardlinks within itself; and the threat is a case author against their own measurement rather than an attacker.\n\nWhat would raise it: a corpus arriving from outside the operator's control, or a recorded result whose corpus digest is disputed. Neither exists today. Reconsider when a case corpus is accepted from a third party.\n\nRanked below ACT-134, which is the same class of hole but closable by the guard the project already has."
    },
    "after": {
      "description": "Decide whether and how to constrain multiply linked corpus files if corpus data later crosses an untrusted boundary.",
      "implementationNotes": "Found by the security, architecture, and spec reviewers on ACT-132 and reproduced\ndirectly by the iterating session at 7af4465.\n\nACT-132's guard is containment of the fully resolved path. A hardlink resolves\nto a path inside the root, because it is a second directory entry for the same\ninode rather than a reference to another path, so realpath reports it as\ncontained and the bytes are read. No path-based check can see this; ACT-132's\nmechanism is as strong as a path-based guard can be, and closing this needs a\ndifferent one, most likely comparing st_dev/st_ino or refusing an entry whose\nlink count exceeds one.\n\nReproduction at 7af4465: a corpus root whose CLAUDE.md is 'ln' (not 'ln -s') to\nan outside file. readCorpusInstructions({kind:'directory',root}) returned\n'HARDLINK SECRET\\n', the outside file's text.\n\nWeigh the cost before building: refusing every multiply-linked file would refuse\na corpus that legitimately hardlinks within itself, and a case corpus arrives as\ndata an author controls, so the threat is a case author rather than a remote\nattacker. Whether this is worth closing at all is the first question the card\nshould answer.\n\nTriage 2026-09-09: priority Low, and it stays a card rather than being archived.\n\nIts own notes ask the right first question, whether this is worth closing at all. Triage's answer is that it is worth keeping open and not worth scheduling, for three reasons taken together: no path-based guard can see a hardlink, so closing it means a different mechanism (st_dev/st_ino comparison or refusing link counts above one); refusing every multiply-linked file would refuse a legitimate corpus that hardlinks within itself; and the threat is a case author against their own measurement rather than an attacker.\n\nWhat would raise it: a corpus arriving from outside the operator's control, or a recorded result whose corpus digest is disputed. Neither exists today. Reconsider when a case corpus is accepted from a third party.\n\nRanked below ACT-134, which is the same class of hole but closable by the guard the project already has.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: defer; next action: investigation. Priority: low. Realpath cannot identify an outside-original hardlink, and link-count refusal would reject legitimate corpora for a threat model that is absent today.\n\nEvidence: Current path containment hashes hardlink bytes; a hardlink is another in-root directory entry for the same inode. No third-party corpus intake is in scope.\n\nUnresolved claims/resources: No accepted untrusted-corpus threat model or non-destructive policy exists.\n\nNext action: Reconsider when third-party corpora are accepted or lineage is disputed; investigate filesystem-policy options then.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-134",
    "evidence": "captureStageCorpus and live corpus-report walking pass rootMayBeALink true. Directory-source reporting already refuses this shape in focused tests. Fresh corpus-probes.ts returned agents/secret.md from an outside tree in both captureStageCorpus and the live corpus report.",
    "before": {
      "description": null,
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "with agents/ in a corpus root replaced by a symlink to a directory outside that root, captureStageCorpus refuses rather than returning the outside directory's files as agents/<name> (probed 2026-09-09 during ACT-130 review: it returned agents/leak.md hashing SECRETBYTES from a separate temp dir, no throw)",
          "checked": false
        },
        {
          "index": 2,
          "text": "the containment rule c9ffe4d states, that an entry is judged by where it resolves, holds for a layout directory as it does for an entry inside one (commit c9ffe4d: 'Containment is the rule that survives')",
          "checked": false
        },
        {
          "index": 3,
          "text": "bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)",
          "checked": false
        },
        {
          "index": 4,
          "text": "against a corpus root whose agents/ is itself a symlink to a directory outside the root, GET /api/corpus returns 200 carrying a refusal that names agents, no digest, and no file from the outside directory among the files (reproduced 2026-09-09 by triage: the live source returned files=[CLAUDE.md, skills/build/SKILL.md, agents/stolen.md] with digest 0f939c and zero refusals, serving a file from outside the corpus as corpus data)",
          "checked": false
        }
      ],
      "implementationNotes": "Found during the ACT-130 code review (2026-09-09), by a reviewer probe, then reproduced directly this session.\n\nMechanism: captureStageCorpus (src/benchmark/checkpoint.ts:270-300) passes\nrootMayBeALink: true at all three hashDirectory call sites, which skips refuseIfLink\nfor the root. Inside the walk, resolvesOutside(root, absolute) compares each entry\nagainst the linked directory as its own root, so nothing under it resolves outside\nand every file is hashed with the layout prefix. The corpus root's own containment\nis never checked for that directory.\n\nReproduction: build a corpus root with CLAUDE.md and skills/build/SKILL.md, create a\nseparate temp dir holding leak.md, then symlink that dir to <corpus>/agents, and call\ncaptureStageCorpus('build', 'hi\\n', [corpus]). Observed 2026-09-09: returned\n[CLAUDE.md, agents/leak.md, skills/build/SKILL.md] with no throw, hashing bytes the\ncorpus does not hold.\n\nPre-existing, not introduced by ACT-130: the three rootMayBeALink call sites are\nuntouched by that change (git diff 5338c41..b367a6c on checkpoint.ts matches\nrootMayBeALink zero times). Recorded there as failing the revert test.\n\nRelation to ACT-113 and c9ffe4d: both closed the entry-level version of this leak.\nThis is the directory-level hole the same rule leaves open. Whether the fix is to\ncheck the layout directory's own containment against the corpus root, or to pass\nrootMayBeALink: false with the live-corpus case handled separately, is open.\n\nNote the live corpus case is why rootMayBeALink: true exists at all: the operator's\nown ~/.claude layout directories are themselves symlinks (recorded in ACT-130's\nshaping under Reproduction). A fix that simply flips the flag would refuse every live\ncorpus. Check that before choosing the approach.\n\nTriage 2026-09-09: priority Medium.\n\nNot High, and the reason is the threat model rather than the mechanism. This is a real containment hole and it is on a shipped surface, but a corpus arrives as data a case author declares, so reaching it means the author symlinked a layout directory out of their own tree. That is a foot-gun, not an attacker path. ACT-132 and ACT-130 were High because one was an open leak on every read surface and the other was a live outage; this is neither.\n\nNot Low: it defeats the containment rule c9ffe4d established, on the same surface that rule was written for, so leaving it means the guard's stated invariant is false and the next reader believes it.\n\nRelation to ACT-133, both filed off the same review: ACT-133 (hardlink) cannot be closed by any path-based guard and its own card says the first question is whether to close it at all. ACT-134 CAN be closed by a path-based guard, since a layout directory's own containment against the corpus root is checkable. So ACT-134 is the actionable one of the pair and ranks above ACT-133.\n\nWarning the card already carries and triage confirms is load-bearing: rootMayBeALink: true exists because the operator's own ~/.claude layout directories ARE symlinks. Verified this run, independently of the card: 'find ~/.claude/agents ~/.claude/skills -type l' returns both ~/.claude/agents and ~/.claude/skills themselves. So flipping the flag refuses the live corpus outright. Whoever builds this must keep the live source working; that is not a hypothetical.\n\nPrecision on the live-corpus warning, triage 2026-09-09 after review. The note above says 'its layout directories are themselves symlinks'. Measured exactly, by 'ls -la ~/.claude/': agents, skills and rulebook are symlinks into ~/.agents, and CLAUDE.md is a symlink to ~/.agents/AGENTS.md. output-styles is an ordinary directory.\n\nSo it is three of four layout directories plus the instruction file, not all of them. The conclusion is unchanged and if anything firmer: flipping rootMayBeALink to false would refuse the live corpus on any of four entries, not just one.\n\nRaised Medium -> High by the overseeing iterate session, 2026-09-09, on evidence that did not exist when the priority was set.\n\nThis card's criteria name captureStageCorpus. The same mechanism also reaches the corpus screen, which the card does not mention. Reproduced this session against the code as it stands after ACT-135 shipped: a root holding CLAUDE.md plus an agents/ that is a symlink to an unrelated directory outside the root returned\n\n  files=CLAUDE.md,agents/stolen.md   digest='19ddbe'   refusals=[]\n\nSo a file that lives entirely outside the corpus is served to the browser as ordinary corpus data, under a confident digest, with no refusal naming it. ACT-135 shipped the refusal for entries inside a layout directory; a layout directory that is itself the link is not covered, and the report presents foreign bytes as corpus rather than failing honestly.\n\nFound by the ACT-135 reflection and independently reproduced here. Same defect class as ACT-137: both put foreign bytes behind a confident digest on the same screen, and both turn on the live source's exemption, which exists because ~/.claude's own layout directories are symlinks into ~/.agents. The reflection's recommendation is to shape the two as one question about what the live source may hash rather than ranking them against each other.\n\nTriage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build, after ACT-137. Priority High, unchanged from the raise the previous run made.\n\nRoute reproduced by triage this run, independently of the card and of doc-55. Root whose agents/ is a symlink to an outside directory holding stolen.md: live source RESOLVED files=[CLAUDE.md, skills/build/SKILL.md, agents/stolen.md] digest=0f939c refusals=[]. So a file from entirely outside the corpus is served as ordinary corpus data under a confident digest. The directory source, by contrast, RESOLVED with digest undefined and a refusal naming agents, which is the degradation ACT-135 shipped.\n\nAC#4 added this run. The screen route was recorded only in these notes and had no criterion, so the screen half of this card had no home in its acceptance. Source is the reproduction above. Found by the advisor's scope-accounting check, confirmed against the card.\n\nDependency on ACT-137 added this run. Reason: both routes turn on the same live-source exemption, and the predicate ACT-137's shaping settles is the one this build inherits. Without the dependency the picker would take this card first, since its lower ID sorts above ACT-137 at equal priority, and the second build would re-decide the containment rule. Verified by reading the ready list back: this card left it, so the picker cannot take it until ACT-137 is Done.\n\nNot merged into ACT-137, deciding against doc-55's proposal to shape them as one piece of work. The probe that settled it: refuseUncontained is called only from corpus-file.ts lines 156 and 198, never from checkpoint.ts, which uses resolvesOutside directly at line 214. This card's AC#1 names captureStageCorpus, a path that never reaches refuseUncontained, so the two cards are separately acceptable and the merge test fails. doc-55's intent is served by the dependency and the shared predicate recorded on ACT-137."
    },
    "after": {
      "description": "Apply the externally declared live-corpus extent to layout directories so roots resolving beyond it are refused in stage capture and corpus reporting.",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "Stage corpus capture refuses a layout directory resolving beyond the configured trusted extent, while a declared live backing tree remains usable (ACT-134 original captureStageCorpus reproduction; ACT-137 recorded declared-extent decision; ACT-141 prerequisite)",
          "checked": false
        },
        {
          "index": 2,
          "text": "Containment is evaluated against the declared source extent for both a layout directory and entries within it, rather than treating an escaping layout root as its own trust anchor (commit c9ffe4d containment rule; ACT-137 recorded extent decision)",
          "checked": false
        },
        {
          "index": 3,
          "text": "bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)",
          "checked": false
        },
        {
          "index": 4,
          "text": "For a live source whose agents directory resolves outside the install root and configured backing extent, GET /api/corpus returns 200 with an agents refusal, no digest and no foreign file entry (ACT-134 original screen reproduction; ACT-137 recorded extent decision; doc-61 fresh probe)",
          "checked": false
        }
      ],
      "implementationNotes": "Found during the ACT-130 code review (2026-09-09), by a reviewer probe, then reproduced directly this session.\n\nMechanism: captureStageCorpus (src/benchmark/checkpoint.ts:270-300) passes\nrootMayBeALink: true at all three hashDirectory call sites, which skips refuseIfLink\nfor the root. Inside the walk, resolvesOutside(root, absolute) compares each entry\nagainst the linked directory as its own root, so nothing under it resolves outside\nand every file is hashed with the layout prefix. The corpus root's own containment\nis never checked for that directory.\n\nReproduction: build a corpus root with CLAUDE.md and skills/build/SKILL.md, create a\nseparate temp dir holding leak.md, then symlink that dir to <corpus>/agents, and call\ncaptureStageCorpus('build', 'hi\\n', [corpus]). Observed 2026-09-09: returned\n[CLAUDE.md, agents/leak.md, skills/build/SKILL.md] with no throw, hashing bytes the\ncorpus does not hold.\n\nPre-existing, not introduced by ACT-130: the three rootMayBeALink call sites are\nuntouched by that change (git diff 5338c41..b367a6c on checkpoint.ts matches\nrootMayBeALink zero times). Recorded there as failing the revert test.\n\nRelation to ACT-113 and c9ffe4d: both closed the entry-level version of this leak.\nThis is the directory-level hole the same rule leaves open. Whether the fix is to\ncheck the layout directory's own containment against the corpus root, or to pass\nrootMayBeALink: false with the live-corpus case handled separately, is open.\n\nNote the live corpus case is why rootMayBeALink: true exists at all: the operator's\nown ~/.claude layout directories are themselves symlinks (recorded in ACT-130's\nshaping under Reproduction). A fix that simply flips the flag would refuse every live\ncorpus. Check that before choosing the approach.\n\nTriage 2026-09-09: priority Medium.\n\nNot High, and the reason is the threat model rather than the mechanism. This is a real containment hole and it is on a shipped surface, but a corpus arrives as data a case author declares, so reaching it means the author symlinked a layout directory out of their own tree. That is a foot-gun, not an attacker path. ACT-132 and ACT-130 were High because one was an open leak on every read surface and the other was a live outage; this is neither.\n\nNot Low: it defeats the containment rule c9ffe4d established, on the same surface that rule was written for, so leaving it means the guard's stated invariant is false and the next reader believes it.\n\nRelation to ACT-133, both filed off the same review: ACT-133 (hardlink) cannot be closed by any path-based guard and its own card says the first question is whether to close it at all. ACT-134 CAN be closed by a path-based guard, since a layout directory's own containment against the corpus root is checkable. So ACT-134 is the actionable one of the pair and ranks above ACT-133.\n\nWarning the card already carries and triage confirms is load-bearing: rootMayBeALink: true exists because the operator's own ~/.claude layout directories ARE symlinks. Verified this run, independently of the card: 'find ~/.claude/agents ~/.claude/skills -type l' returns both ~/.claude/agents and ~/.claude/skills themselves. So flipping the flag refuses the live corpus outright. Whoever builds this must keep the live source working; that is not a hypothetical.\n\nPrecision on the live-corpus warning, triage 2026-09-09 after review. The note above says 'its layout directories are themselves symlinks'. Measured exactly, by 'ls -la ~/.claude/': agents, skills and rulebook are symlinks into ~/.agents, and CLAUDE.md is a symlink to ~/.agents/AGENTS.md. output-styles is an ordinary directory.\n\nSo it is three of four layout directories plus the instruction file, not all of them. The conclusion is unchanged and if anything firmer: flipping rootMayBeALink to false would refuse the live corpus on any of four entries, not just one.\n\nRaised Medium -> High by the overseeing iterate session, 2026-09-09, on evidence that did not exist when the priority was set.\n\nThis card's criteria name captureStageCorpus. The same mechanism also reaches the corpus screen, which the card does not mention. Reproduced this session against the code as it stands after ACT-135 shipped: a root holding CLAUDE.md plus an agents/ that is a symlink to an unrelated directory outside the root returned\n\n  files=CLAUDE.md,agents/stolen.md   digest='19ddbe'   refusals=[]\n\nSo a file that lives entirely outside the corpus is served to the browser as ordinary corpus data, under a confident digest, with no refusal naming it. ACT-135 shipped the refusal for entries inside a layout directory; a layout directory that is itself the link is not covered, and the report presents foreign bytes as corpus rather than failing honestly.\n\nFound by the ACT-135 reflection and independently reproduced here. Same defect class as ACT-137: both put foreign bytes behind a confident digest on the same screen, and both turn on the live source's exemption, which exists because ~/.claude's own layout directories are symlinks into ~/.agents. The reflection's recommendation is to shape the two as one question about what the live source may hash rather than ranking them against each other.\n\nRoute reproduced by triage this run, independently of the card and of doc-55. Root whose agents/ is a symlink to an outside directory holding stolen.md: live source RESOLVED files=[CLAUDE.md, skills/build/SKILL.md, agents/stolen.md] digest=0f939c refusals=[]. So a file from entirely outside the corpus is served as ordinary corpus data under a confident digest. The directory source, by contrast, RESOLVED with digest undefined and a refusal naming agents, which is the degradation ACT-135 shipped.\n\nAC#4 added this run. The screen route was recorded only in these notes and had no criterion, so the screen half of this card had no home in its acceptance. Source is the reproduction above. Found by the advisor's scope-accounting check, confirmed against the card.\n\nDependency on ACT-137 added this run. Reason: both routes turn on the same live-source exemption, and the predicate ACT-137's shaping settles is the one this build inherits. Without the dependency the picker would take this card first, since its lower ID sorts above ACT-137 at equal priority, and the second build would re-decide the containment rule. Verified by reading the ready list back: this card left it, so the picker cannot take it until ACT-137 is Done.\n\nNot merged into ACT-137, deciding against doc-55's proposal to shape them as one piece of work. The probe that settled it: refuseUncontained is called only from corpus-file.ts lines 156 and 198, never from checkpoint.ts, which uses resolvesOutside directly at line 214. This card's AC#1 names captureStageCorpus, a path that never reaches refuseUncontained, so the two cards are separately acceptable and the merge test fails. doc-55's intent is served by the dependency and the shared predicate recorded on ACT-137.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: implementation. Priority: high. Live layout-root symlinks can still place foreign bytes behind a confident digest; the declared extent from ACT-141 supplies the missing trust predicate.\n\nEvidence: captureStageCorpus and live corpus-report walking pass rootMayBeALink true. Directory-source reporting already refuses this shape in focused tests. Fresh corpus-probes.ts returned agents/secret.md from an outside tree in both captureStageCorpus and the live corpus report.\n\nUnresolved claims/resources: ACT-141\n\nNext action: After ACT-141, apply the declared extent to layout-root resolution in both stage capture and GET /api/corpus; rewrite AC1 to name the live-source case.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-141",
    "evidence": "refuseUncontained returns early for kind live and CorpusRoot has no extent. Current live report is healthy at 122 files, digest 723012, zero refusals; the old c7000b digest is stale.",
    "before": {
      "description": null,
      "priority": null,
      "status": "To Do",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "corpusReport under a live source, on a root whose CLAUDE.md is a symlink resolving outside both the install root and the declared extent, returns a refusal naming CLAUDE.md and no digest (ACT-137 AC#1, left unchecked there because it needs the extent; reproduced 2026-09-09 on ACT-137: live source returned digest over files [CLAUDE.md, skills/build/SKILL.md] with zero refusals)",
          "checked": false
        },
        {
          "index": 2,
          "text": "corpusReport(liveCorpusSource()) on this machine still returns 122 files, digest c7000b, and zero refusals (measured 2026-09-09 on ACT-137 by running corpusReport against the live install)",
          "checked": false
        },
        {
          "index": 3,
          "text": "GET /api/corpus on that hostile live root returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)",
          "checked": false
        }
      ],
      "implementationNotes": "Split out of ACT-137's build, 2026-09-09. ACT-137 shipped the directory-source half: the instruction file's hash now sits inside the same try/catch the layout loop uses, so a SymlinkedEntryError on CLAUDE.md becomes a named refusal in a 200 report instead of a 500.\n\nThis card carries what ACT-137 could not deliver, its AC#1: the same refusal under a LIVE source. That half needs the declared extent, which ACT-137's card records as decided (the live install root plus the real path of the tree its layout entries point into, read as configuration from outside the corpus root, defaulting to [~/.claude, ~/.agents] on this machine). Nothing implements it yet.\n\nWhy it could not ship inside ACT-137: refuseUncontained returns early for kind === 'live' (src/benchmark/corpus-file.ts). Removing that exemption with no extent empties every live report, because the operator's own CLAUDE.md is a symlink into ~/.agents. Measured this session by running corpusReport against the live install: 122 files, digest c7000b, zero refusals. That number is the regression guard, and it is why the exemption cannot simply be deleted.\n\nDoc-58 counted the consumers any change to live containment reaches. Read that section before starting; the calibration.ts call site is synchronous, so making liveCorpusSource() async breaks it.\n\nThe symlinked-layout-directory half of the same defect is ACT-134, which depends on ACT-137 and reads the same predicate. ACT-134 and this card are the same question asked on two call paths: this one goes through refuseUncontained, ACT-134's goes through walkDirectory's rootMayBeALink.\n\nAC#2 IS ALREADY STALE, confirmed by the overseeing iterate session, 2026-09-09, independently of the reflection that raised it.\n\nAC#2 pins the live corpus at \"122 files, digest c7000b, zero refusals\". Measured on this machine after ACT-137 landed:\n\n  files 122 digest 723012 refusals 0\n\nThe file count and the refusal count hold; the digest does not. It changed because the corpus itself changed, which is exactly what a live corpus does by design (decision-4: \"enumerated and hashed as it is today\"). So this criterion fails on a perfectly healthy system, and whoever builds this card meets a red check that indicates nothing wrong.\n\nThe intent behind AC#2 is sound and worth keeping: the fix must not empty the live report. The digest is the wrong instrument for it. Rewrite AC#2 as the behavior that survives a corpus edit, for instance: corpusReport(liveCorpusSource()) returns the same file count and zero refusals before and after the change, both measured in the same run. That is checkable under every approach this card leaves open, which a frozen digest is not.\n\nNot rewriting it here, because this card is in To Do and its shaping session owns its criteria. Recorded so that session fixes it rather than inheriting it.",
      "documentation": [
        "backlog/docs/doc-58 - Shaping-ACT-137-live-corpus-containment.md"
      ]
    },
    "after": {
      "description": "Hold live corpus resolution to an extent declared outside the corpus root, allowing the configured backing tree while refusing paths beyond both trusted roots.",
      "priority": "high",
      "status": "Shape",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "corpusReport under a live source, on a root whose CLAUDE.md is a symlink resolving outside both the install root and the declared extent, returns a refusal naming CLAUDE.md and no digest (ACT-137 AC#1, left unchecked there because it needs the extent; reproduced 2026-09-09 on ACT-137: live source returned digest over files [CLAUDE.md, skills/build/SKILL.md] with zero refusals)",
          "checked": false
        },
        {
          "index": 2,
          "text": "A controlled healthy live fixture with legitimate links into its declared backing tree retains the same file identities and zero refusals after the change; compare the actual local live file set before/after within one run without pinning a mutable digest (original live-report regression intent; decision-4; doc-60 and doc-61 stale-digest verification)",
          "checked": false
        },
        {
          "index": 3,
          "text": "GET /api/corpus on that hostile live root returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)",
          "checked": false
        }
      ],
      "implementationNotes": "Split out of ACT-137's build, 2026-09-09. ACT-137 shipped the directory-source half: the instruction file's hash now sits inside the same try/catch the layout loop uses, so a SymlinkedEntryError on CLAUDE.md becomes a named refusal in a 200 report instead of a 500.\n\nThis card carries what ACT-137 could not deliver, its AC#1: the same refusal under a LIVE source. That half needs the declared extent, which ACT-137's card records as decided (the live install root plus the real path of the tree its layout entries point into, read as configuration from outside the corpus root, defaulting to [~/.claude, ~/.agents] on this machine). Nothing implements it yet.\n\nWhy it could not ship inside ACT-137: refuseUncontained returns early for kind === 'live' (src/benchmark/corpus-file.ts). Removing that exemption with no extent empties every live report, because the operator's own CLAUDE.md is a symlink into ~/.agents. Measured this session by running corpusReport against the live install: 122 files, digest c7000b, zero refusals. That number is the regression guard, and it is why the exemption cannot simply be deleted.\n\nDoc-58 counted the consumers any change to live containment reaches. Read that section before starting; the calibration.ts call site is synchronous, so making liveCorpusSource() async breaks it.\n\nThe symlinked-layout-directory half of the same defect is ACT-134, which depends on ACT-137 and reads the same predicate. ACT-134 and this card are the same question asked on two call paths: this one goes through refuseUncontained, ACT-134's goes through walkDirectory's rootMayBeALink.\n\nAC#2 IS ALREADY STALE, confirmed by the overseeing iterate session, 2026-09-09, independently of the reflection that raised it.\n\nAC#2 pins the live corpus at \"122 files, digest c7000b, zero refusals\". Measured on this machine after ACT-137 landed:\n\n  files 122 digest 723012 refusals 0\n\nThe file count and the refusal count hold; the digest does not. It changed because the corpus itself changed, which is exactly what a live corpus does by design (decision-4: \"enumerated and hashed as it is today\"). So this criterion fails on a perfectly healthy system, and whoever builds this card meets a red check that indicates nothing wrong.\n\nThe intent behind AC#2 is sound and worth keeping: the fix must not empty the live report. The digest is the wrong instrument for it. Rewrite AC#2 as the behavior that survives a corpus edit, for instance: corpusReport(liveCorpusSource()) returns the same file count and zero refusals before and after the change, both measured in the same run. That is checkable under every approach this card leaves open, which a frozen digest is not.\n\nNot rewriting it here, because this card is in To Do and its shaping session owns its criteria. Recorded so that session fixes it rather than inheriting it.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\nCurrent policy source: the ACT-137 note headed DECIDED BY THE OVERSEEING ITERATE SESSION takes the externally declared extent under the unattended rule and records its reading of decision-4. Doc-58’s earlier blocked heading is historical. Triage retains the recorded decision; configuration representation and propagation remain shaping work. ACT-134 already depends on this card.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: high. This establishes the live trust boundary and is the feasible prerequisite for the remaining layout-root containment hole.\n\nEvidence: refuseUncontained returns early for kind live and CorpusRoot has no extent. Current live report is healthy at 122 files, digest 723012, zero refusals; the old c7000b digest is stale.\n\nUnresolved claims/resources: None for the next action.\n\nNext action: Shape external extent configuration and its propagation to synchronous live-source callers, using the settled declared-extent policy from ACT-137. Test a synthetic allowed backing tree and a hostile outside target. Then implement without provider spend.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).",
      "documentation": [
        "backlog/docs/doc-58 - Shaping-ACT-137-live-corpus-containment.md",
        "backlog/docs/doc-61 - Triage-rehearsal-backlog.md"
      ]
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-142",
    "evidence": "staleCheckpoints calls readCorpusInstructions outside a catch; /api/runs has no route catch; the client renders its load-error message on query failure. Fresh corpus-probes.ts reproduced a LIVE self-looping CLAUDE.md with /api/corpus 200 refusal and /api/runs 500 when recorded runs exist. Empty run history returned 200; the record fixture is required.",
    "before": {
      "description": null,
      "priority": null,
      "status": "To Do",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "with a corpus root whose CLAUDE.md is a symlink resolving outside it, GET /api/runs returns 200 and names the unreadable corpus file, rather than a 500 (reproduced 2026-09-09 by the ACT-137 review: /api/corpus returned 200 with a refusal while /api/runs returned 500 {\"error\":\"Corpus file CLAUDE.md resolves outside the corpus source...\"} on one app instance)",
          "checked": false
        },
        {
          "index": 2,
          "text": "the run-history screen against that corpus state does not render 'Could not load run history.' (client/src/run-history/run-history-page.tsx pins that text to the query error, read 2026-09-09)",
          "checked": false
        },
        {
          "index": 3,
          "text": "bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)",
          "checked": false
        }
      ],
      "implementationNotes": "Found by ACT-137's code review, 2026-09-09, and confirmed at the source by that session: readCorpusInstructions on a directory source whose CLAUDE.md symlinks outside the root throws SymlinkedEntryError. src/benchmark/staleness-report.ts:181 calls it outside any try, and src/server/api.ts wraps the /api/runs route in no try/catch, so the throw reaches app.onError as a 500. hashCorpusFiles at staleness-report.ts:306 is the second unwrapped call site; caseStaleness at :300 already wraps its own.\n\nThe ACT-137 session verified the throw directly and filed this without reproducing the HTTP 500 itself; the review reproduced that, hitting both routes on one app instance.\n\nWhy it was not fixed inside ACT-137: the fix lands in staleness-report.ts, which that card never touched, on a different route and a different screen. ACT-137 fixed /api/corpus only.\n\nThe shape ACT-137 landed is the precedent: a refusal string in a 200 report, never a throw, because the operator learns which file broke the corpus rather than reading 'Could not load run history.' Whoever takes this should decide whether the run-history report grows a refusals field of its own or reuses the corpus report's, and should check whether the other staleness consumers (the stale CLI command) want the same treatment or want the throw."
    },
    "after": {
      "description": "Keep run history usable when current corpus instructions are refused, naming the corpus entry instead of returning a route error.",
      "priority": "medium",
      "status": "Shape",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "With recorded runs present, GET /api/runs returns 200 and names refused CLAUDE.md evidence when a directory-source instruction link escapes or a live instruction link loops, while preserving readable history (ACT-142 original directory-source reproduction; doc-61 live-root-loop reproduction with recorded runs)",
          "checked": false
        },
        {
          "index": 2,
          "text": "the run-history screen against that corpus state does not render 'Could not load run history.' (client/src/run-history/run-history-page.tsx pins that text to the query error, read 2026-09-09)",
          "checked": false
        },
        {
          "index": 3,
          "text": "bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)",
          "checked": false
        }
      ],
      "implementationNotes": "Found by ACT-137's code review, 2026-09-09, and confirmed at the source by that session: readCorpusInstructions on a directory source whose CLAUDE.md symlinks outside the root throws SymlinkedEntryError. src/benchmark/staleness-report.ts:181 calls it outside any try, and src/server/api.ts wraps the /api/runs route in no try/catch, so the throw reaches app.onError as a 500. hashCorpusFiles at staleness-report.ts:306 is the second unwrapped call site; caseStaleness at :300 already wraps its own.\n\nThe ACT-137 session verified the throw directly and filed this without reproducing the HTTP 500 itself; the review reproduced that, hitting both routes on one app instance.\n\nWhy it was not fixed inside ACT-137: the fix lands in staleness-report.ts, which that card never touched, on a different route and a different screen. ACT-137 fixed /api/corpus only.\n\nThe shape ACT-137 landed is the precedent: a refusal string in a 200 report, never a throw, because the operator learns which file broke the corpus rather than reading 'Could not load run history.' Whoever takes this should decide whether the run-history report grows a refusals field of its own or reuses the corpus report's, and should check whether the other staleness consumers (the stale CLI command) want the same treatment or want the throw.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. A refused instruction file currently blanks run history, but the response contract and CLI stale behavior must be chosen together.\n\nEvidence: staleCheckpoints calls readCorpusInstructions outside a catch; /api/runs has no route catch; the client renders its load-error message on query failure. Fresh corpus-probes.ts reproduced a LIVE self-looping CLAUDE.md with /api/corpus 200 refusal and /api/runs 500 when recorded runs exist. Empty run history returned 200; the record fixture is required.\n\nUnresolved claims/resources: Structured run-history refusal placement and CLI behavior are unset.\n\nNext action: Choose a named structured refusal for /api/runs, decide whether stale CLI still throws, then add API and client acceptance tests.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-150",
    "evidence": "walkDirectory classifies outside/dangling links only; instruction entry handling classifies ELOOP/EACCES/EPERM and non-files. Focused suite expects unreadable layout failure today. Fresh corpus-probes.ts returned HTTP 500 for EACCES and ELOOP in a live agents directory; healthy live state was 122 files, digest 723012, no refusals.",
    "before": {
      "description": null,
      "priority": null,
      "status": "To Do",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "corpusReport on a directory source whose agents/ holds a file that cannot be read returns a refusal naming that file and no digest, rather than throwing EACCES (reproduced 2026-09-09 on ACT-137: corpusReport THREW EACCES 'permission denied, lstat ...' before returning any report)",
          "checked": false
        },
        {
          "index": 2,
          "text": "corpusReport on a directory source whose agents/ holds a symlink pointing at itself returns a refusal naming that file and no digest, rather than throwing ELOOP (reproduced 2026-09-09 on ACT-137: corpusReport THREW ELOOP 'too many symbolic links encountered')",
          "checked": false
        },
        {
          "index": 3,
          "text": "GET /api/corpus in both states returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)",
          "checked": false
        },
        {
          "index": 4,
          "text": "the live corpus report is unchanged at 122 files, digest c7000b, zero refusals (measured 2026-09-09 on ACT-137, as a regression guard)",
          "checked": false
        }
      ],
      "implementationNotes": "Found by ACT-137's after-task pass, 2026-09-09, and reproduced by that session rather than reasoned about.\n\nACT-137 fixed these states for the INSTRUCTION FILE only: a CLAUDE.md that is unreadable, loops, dangles, names a directory, or leaves the root is now a named refusal in a 200 report. The same states inside a layout directory (agents/, output-styles/, rulebook/) still throw out of walkDirectory and reach app.onError as a 500.\n\nThe structural finding underneath: 'how a corpus entry fails to be hashable' is now knowledge encoded in two places. src/benchmark/checkpoint.ts refuses two states in its walk (an entry resolving outside the tree, a link whose target is missing) and src/server/corpus-report.ts refuses five for the instruction file. The walk's two are a subset. Whoever takes this should consider whether the walk grows the missing three or whether both sides read one shared classifier, rather than adding a third copy.\n\nWording to match, so the screen speaks with one voice: checkpoint.ts:101 owns 'is a link whose target is missing, so the bytes it names cannot be read' and corpus-report.ts reuses that sentence for the same condition. ACT-137 gave ELOOP its own wording ('is a link that never resolves to a file, so it names no bytes') because the dangling sentence is false for a loop: the target exists and following it is what does not end.\n\nNote that walkDirectory returns refusals as a LIST and corpusReport already maps them into the report, so the layout half may be a smaller change than the instruction half was: the plumbing exists, the classification does not."
    },
    "after": {
      "description": "Turn unhashable files inside corpus layout directories into named refusals and a 200 corpus report, using the same classification as the instruction file.",
      "priority": "medium",
      "status": "Shape",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "corpusReport on a directory source whose agents/ holds a file that cannot be read returns a refusal naming that file and no digest, rather than throwing EACCES (reproduced 2026-09-09 on ACT-137: corpusReport THREW EACCES 'permission denied, lstat ...' before returning any report)",
          "checked": false
        },
        {
          "index": 2,
          "text": "corpusReport on a directory source whose agents/ holds a symlink pointing at itself returns a refusal naming that file and no digest, rather than throwing ELOOP (reproduced 2026-09-09 on ACT-137: corpusReport THREW ELOOP 'too many symbolic links encountered')",
          "checked": false
        },
        {
          "index": 3,
          "text": "GET /api/corpus in both states returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)",
          "checked": false
        },
        {
          "index": 4,
          "text": "A controlled healthy live fixture with legitimate links into its declared backing tree retains the same file identities and zero refusals after the change; compare the actual local live file set before/after within one run without pinning a mutable digest (original live-report regression intent; decision-4; doc-60 and doc-61 stale-digest verification)",
          "checked": false
        }
      ],
      "implementationNotes": "Found by ACT-137's after-task pass, 2026-09-09, and reproduced by that session rather than reasoned about.\n\nACT-137 fixed these states for the INSTRUCTION FILE only: a CLAUDE.md that is unreadable, loops, dangles, names a directory, or leaves the root is now a named refusal in a 200 report. The same states inside a layout directory (agents/, output-styles/, rulebook/) still throw out of walkDirectory and reach app.onError as a 500.\n\nThe structural finding underneath: 'how a corpus entry fails to be hashable' is now knowledge encoded in two places. src/benchmark/checkpoint.ts refuses two states in its walk (an entry resolving outside the tree, a link whose target is missing) and src/server/corpus-report.ts refuses five for the instruction file. The walk's two are a subset. Whoever takes this should consider whether the walk grows the missing three or whether both sides read one shared classifier, rather than adding a third copy.\n\nWording to match, so the screen speaks with one voice: checkpoint.ts:101 owns 'is a link whose target is missing, so the bytes it names cannot be read' and corpus-report.ts reuses that sentence for the same condition. ACT-137 gave ELOOP its own wording ('is a link that never resolves to a file, so it names no bytes') because the dangling sentence is false for a loop: the target exists and following it is what does not end.\n\nNote that walkDirectory returns refusals as a LIST and corpusReport already maps them into the report, so the layout half may be a smaller change than the instruction half was: the plumbing exists, the classification does not.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. Unreadable and looping layout entries can still fail the whole corpus screen; one shared classifier should prevent a third divergent error vocabulary.\n\nEvidence: walkDirectory classifies outside/dangling links only; instruction entry handling classifies ELOOP/EACCES/EPERM and non-files. Focused suite expects unreadable layout failure today. Fresh corpus-probes.ts returned HTTP 500 for EACCES and ELOOP in a live agents directory; healthy live state was 122 files, digest 723012, no refusals.\n\nUnresolved claims/resources: Shared entry-failure classifier boundary needs a short design pass.\n\nNext action: Extract or share failure classification, return named layout refusals with no digest, and test synthetic ELOOP plus platform-capable unreadable cases; use before/after live equivalence instead of a literal digest.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-140",
    "evidence": "executeSessionRun rejects runConfirmed. Confirmation records accept session checks but frozenInputsSchema requires pipelinePath; the representation must be resolved before implementation. 143 focused tests pass. The normal smoke command stops earlier because claude is missing from PATH.",
    "before": {
      "description": null,
      "milestone": null,
      "status": "To Do",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "rehearsal run on a session case with --confirm --reps N executes N reps and writes a confirmation group record, instead of refusing with 'A session confirmation group is not built yet' (observed 2026-09-09: 'run --case smoke --model sonnet --confirm --reps 2 --yes' printed the projection then refused, exiting without a provider call)",
          "checked": false
        },
        {
          "index": 2,
          "text": "rehearsal list groups returns the written group and rehearsal show on its id prints the record (observed 2026-09-09: list groups is empty and no command produces a session group)",
          "checked": false
        },
        {
          "index": 3,
          "text": "the projected cost is shown and approved before any provider call, as it is today (run-command.ts line 392 records that ordering as deliberate)",
          "checked": false
        },
        {
          "index": 4,
          "text": "Each repetition runs in its own attempt directory from the group’s frozen shared inputs (João’s approved session benchmark scope, doc-59)",
          "checked": false
        },
        {
          "index": 5,
          "text": "If one repetition fails, peer repetitions complete and the group records the failed repetition rather than silently dropping it (João’s approved session benchmark scope, doc-59)",
          "checked": false
        },
        {
          "index": 6,
          "text": "Each repetition’s named check results remain available through its recorded attempt evidence (João’s approved session benchmark scope, doc-59)",
          "checked": false
        }
      ],
      "implementationNotes": "Filed 2026-09-09 by the iterate session, blocking ACT-69.\n\nACT-69's compare was authorized at 25 USD in session mode on the finding that the comparison report schema accepts mode 'session' (confirmationModeSchema is ['stage','pipeline','session'], and cases/ holds ten session cases). The schema does accept it. The runner cannot produce it, which is what this card builds.\n\nexecuteSessionRun in src/cli/run-command.ts projects the cost and then refuses at line 432. The comment at line 392 states the intent: the projection is shown and the group refused before any provider call, so the cost-approval ordering holds whether or not the group exists. Keep that ordering, which is why it is AC#3.\n\nThe built siblings to follow are runPipelineConfirmation in src/benchmark/pipeline-confirmation.ts and runReplayConfirmation in src/benchmark/replay-confirmation.ts. confirmation-record.ts already parses a session group: see confirmation-record.test.ts, 'accepts a session group at schema version 1, with checks as its one stage'. So the record shape exists and this card wires the runner to it.\n\nCost of this card is its own reps, not ACT-69's compare. A session rep on the smoke case projects at 0.20 USD.\n\nDesign read, 2026-09-09, by the overseeing iterate session. Handed off unbuilt so a fresh session can build it without another session running in the same tree. Every claim below was read at the source this session.\n\nThe seam is one hook. executeSessionRun in src/cli/run-command.ts (around line 396) already wires runRequestedExecution with projectCost, approval, and runDebug working; only runConfirmed rejects, at line 432. Fill that hook and the command works. Do not touch the projection or approval ordering: the comment at line 392 records it as deliberate, which is AC#3.\n\nThe rep contract is already specified by tests, so follow them rather than inventing it. confirmation-record.test.ts 'accepts a session rep at schema version 1, with its checks as one stage' fixes the mapping: one stage entry named 'checks', status JUDGED, verdict CONTINUE and grade A when the checks pass, verdict STOP and grade F when they fail (its sibling test 'refuses a session rep called successful when its checks failed' enforces that), finalOutcome { status: 'NOT_APPLICABLE' }, and worktreePath set to the attempt directory rather than a real worktree. The group contract is 'accepts a session group at schema version 1, with checks as its one stage': mode 'session', declaredStages ['checks'].\n\nTwo schema constraints to plan for. confirmationRepRecordSchema requires workerTrajectorySteps to equal the provider-reported worker turns, and requires repId to equal '<groupId>-rep-<ordinal>'; runConfirmation in src/benchmark/confirmation.ts already generates that id shape, so reuse it rather than formatting the id again. frozenInputsSchema requires pipelinePath as a non-empty string, which a session case has no equivalent for. The existing test fixture uses 'pipelines/default.json'. Decide what a session group puts there and record the decision on this card; that is the one open modeling question in this build.\n\nWhat to reuse rather than rebuild. runConfirmation (confirmation.ts line 155) is generic over inputs and result and already plans the reps and their ids. runSessionDebugAttempt (src/cli/session-run-command.ts line 225) is the single rep's work: it resolves the corpus, computes lineage, runs the attempt, and writes the attempt record. A rep is that attempt against inputs frozen once for the group. projectConfirmationCost already handles mode 'session' at one session per rep, verified by running the command.\n\nWhat NOT to copy. runPipelineConfirmation and runReplayConfirmation both create git worktrees and materialize checkpoints because they run code stages against a target. A session case declares neither a target nor a pipeline, so it needs no worktree and no checkpoint materialization. Following those two siblings literally is the main way to overbuild this card.\n\nVerification available at no provider cost: 'mise exec -- ./rehearsal.ts run --case smoke --model sonnet --confirm --reps 2 --yes' currently prints 'Projected maximum cost: $0.40 (2 reps x $0.20)' then refuses. That command is AC#1's probe. 'rehearsal list groups' is empty today, which is AC#2's starting state.\n\nBudget note: this card's own spend is its reps, at about 0.20 USD per rep on the smoke case. It is not ACT-69's 25 USD, which stays unspent for the compare after this lands.\n\nApproved session benchmark scope, 2026-09-09 (doc-59): reuse this existing card for confirmation execution. ACT-143 adds frozen skill delivery; ACT-144 adds generated fixture inputs; ACT-145 adds preserved state and named grading results; ACT-146 owns session comparison, single-case statistics and partial-score reporting; ACT-147 owns regrading. This card can deliver repetitions of existing session cases without waiting for all those capabilities.\n\nExtend the runner's acceptance to isolated repetitions from one frozen set of shared inputs, peer failure records and group accounting. Preserve the actual named check results through the attempt evidence referenced by each rep, even if the current compatibility summary maps them to A/F. Let ACT-146 consume that evidence rather than reconstructing individual checks from the aggregate letter. The frozen-input schema's pipelinePath placeholder remains a design question: represent actual session input evidence instead of recording a fabricated pipeline as if it ran. ACT-146 also needs a session-specific quality path; a schema accepting mode session does not make comparison-quality support it.\n\nFirst new verification target: one rep fails while its peers complete, with all repetitions starting from the same frozen shared inputs. No new provider spend was authorized or incurred in this card-filing session.",
      "documentation": []
    },
    "after": {
      "description": "Run existing session cases as isolated repetitions from one captured input set, preserving every successful and failed attempt in a readable confirmation group. Cost projection and approval precede provider calls. Resolve the session frozen-input representation during shaping; do not record an invented pipeline. The present runConfirmed hook deliberately refuses and the installed CLI environment cannot find claude. ACT-69 owns the existing USD 25 comparison budget; this implementation has no separately recorded provider-spend allowance.",
      "milestone": "m-7",
      "status": "Shape",
      "acceptanceCriteria": [
        {
          "index": 1,
          "text": "rehearsal run on a session case with --confirm --reps N executes N reps and writes a confirmation group record, instead of refusing with 'A session confirmation group is not built yet' (observed 2026-09-09: 'run --case smoke --model sonnet --confirm --reps 2 --yes' printed the projection then refused, exiting without a provider call)",
          "checked": false
        },
        {
          "index": 2,
          "text": "rehearsal list groups returns the written group and rehearsal show on its id prints the record (observed 2026-09-09: list groups is empty and no command produces a session group)",
          "checked": false
        },
        {
          "index": 3,
          "text": "The projected cost is shown and approved before any provider call (executeSessionRun and runRequestedExecution ordering; ACT-140 original AC3)",
          "checked": false
        },
        {
          "index": 4,
          "text": "Each repetition runs in its own attempt directory from the group’s frozen shared inputs (João’s approved session benchmark scope, doc-59)",
          "checked": false
        },
        {
          "index": 5,
          "text": "If one repetition fails, peer repetitions complete and the group records the failed repetition rather than silently dropping it (João’s approved session benchmark scope, doc-59)",
          "checked": false
        },
        {
          "index": 6,
          "text": "Each repetition’s named check results remain available through its recorded attempt evidence (João’s approved session benchmark scope, doc-59)",
          "checked": false
        }
      ],
      "implementationNotes": "Filed 2026-09-09 by the iterate session, blocking ACT-69.\n\nACT-69's compare was authorized at 25 USD in session mode on the finding that the comparison report schema accepts mode 'session' (confirmationModeSchema is ['stage','pipeline','session'], and cases/ holds ten session cases). The schema does accept it. The runner cannot produce it, which is what this card builds.\n\nexecuteSessionRun in src/cli/run-command.ts projects the cost and then refuses at line 432. The comment at line 392 states the intent: the projection is shown and the group refused before any provider call, so the cost-approval ordering holds whether or not the group exists. Keep that ordering, which is why it is AC#3.\n\nThe built siblings to follow are runPipelineConfirmation in src/benchmark/pipeline-confirmation.ts and runReplayConfirmation in src/benchmark/replay-confirmation.ts. confirmation-record.ts already parses a session group: see confirmation-record.test.ts, 'accepts a session group at schema version 1, with checks as its one stage'. So the record shape exists and this card wires the runner to it.\n\nCost of this card is its own reps, not ACT-69's compare. A session rep on the smoke case projects at 0.20 USD.\n\nDesign read, 2026-09-09, by the overseeing iterate session. Handed off unbuilt so a fresh session can build it without another session running in the same tree. Every claim below was read at the source this session.\n\nThe seam is one hook. executeSessionRun in src/cli/run-command.ts (around line 396) already wires runRequestedExecution with projectCost, approval, and runDebug working; only runConfirmed rejects, at line 432. Fill that hook and the command works. Do not touch the projection or approval ordering: the comment at line 392 records it as deliberate, which is AC#3.\n\nThe rep contract is already specified by tests, so follow them rather than inventing it. confirmation-record.test.ts 'accepts a session rep at schema version 1, with its checks as one stage' fixes the mapping: one stage entry named 'checks', status JUDGED, verdict CONTINUE and grade A when the checks pass, verdict STOP and grade F when they fail (its sibling test 'refuses a session rep called successful when its checks failed' enforces that), finalOutcome { status: 'NOT_APPLICABLE' }, and worktreePath set to the attempt directory rather than a real worktree. The group contract is 'accepts a session group at schema version 1, with checks as its one stage': mode 'session', declaredStages ['checks'].\n\nTwo schema constraints to plan for. confirmationRepRecordSchema requires workerTrajectorySteps to equal the provider-reported worker turns, and requires repId to equal '<groupId>-rep-<ordinal>'; runConfirmation in src/benchmark/confirmation.ts already generates that id shape, so reuse it rather than formatting the id again. frozenInputsSchema requires pipelinePath as a non-empty string, which a session case has no equivalent for. The existing test fixture uses 'pipelines/default.json'. Decide what a session group puts there and record the decision on this card; that is the one open modeling question in this build.\n\nWhat to reuse rather than rebuild. runConfirmation (confirmation.ts line 155) is generic over inputs and result and already plans the reps and their ids. runSessionDebugAttempt (src/cli/session-run-command.ts line 225) is the single rep's work: it resolves the corpus, computes lineage, runs the attempt, and writes the attempt record. A rep is that attempt against inputs frozen once for the group. projectConfirmationCost already handles mode 'session' at one session per rep, verified by running the command.\n\nWhat NOT to copy. runPipelineConfirmation and runReplayConfirmation both create git worktrees and materialize checkpoints because they run code stages against a target. A session case declares neither a target nor a pipeline, so it needs no worktree and no checkpoint materialization. Following those two siblings literally is the main way to overbuild this card.\n\nVerification available at no provider cost: 'mise exec -- ./rehearsal.ts run --case smoke --model sonnet --confirm --reps 2 --yes' currently prints 'Projected maximum cost: $0.40 (2 reps x $0.20)' then refuses. That command is AC#1's probe. 'rehearsal list groups' is empty today, which is AC#2's starting state.\n\nBudget note: this card's own spend is its reps, at about 0.20 USD per rep on the smoke case. It is not ACT-69's 25 USD, which stays unspent for the compare after this lands.\n\nApproved session benchmark scope, 2026-09-09 (doc-59): reuse this existing card for confirmation execution. ACT-143 adds frozen skill delivery; ACT-144 adds generated fixture inputs; ACT-145 adds preserved state and named grading results; ACT-146 owns session comparison, single-case statistics and partial-score reporting; ACT-147 owns regrading. This card can deliver repetitions of existing session cases without waiting for all those capabilities.\n\nExtend the runner's acceptance to isolated repetitions from one frozen set of shared inputs, peer failure records and group accounting. Preserve the actual named check results through the attempt evidence referenced by each rep, even if the current compatibility summary maps them to A/F. Let ACT-146 consume that evidence rather than reconstructing individual checks from the aggregate letter. The frozen-input schema's pipelinePath placeholder remains a design question: represent actual session input evidence instead of recording a fabricated pipeline as if it ran. ACT-146 also needs a session-specific quality path; a schema accepting mode session does not make comparison-quality support it.\n\nFirst new verification target: one rep fails while its peers complete, with all repetitions starting from the same frozen shared inputs. No new provider spend was authorized or incurred in this card-filing session.\n\nCriteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: high. Confirmation execution blocks the authorized two-case comparison; without it no session group exists to compare.\n\nEvidence: executeSessionRun rejects runConfirmed. Confirmation records accept session checks but frozenInputsSchema requires pipelinePath; the representation must be resolved before implementation. 143 focused tests pass. The normal smoke command stops earlier because claude is missing from PATH.\n\nUnresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.\n\nNext action: Shape the session-specific frozen-input record and map isolated attempts into runConfirmation. Bound this to one shaping session without provider spend. Build can use injected runners; real smoke evidence waits for the executable.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).",
      "documentation": [
        "backlog/docs/doc-61 - Triage-rehearsal-backlog.md"
      ]
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-143",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: explicit skill refused; mutation after a live snapshot changes its bytes to after. installSessionCorpusSnapshot skips live snapshots and overlays no skills.",
    "before": {
      "milestone": null,
      "status": "To Do",
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "status": "Shape",
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. The approved skill experiment needs actual variant delivery with fixed surrounding inputs. Delay postpones the new experiment while comparison prerequisites are resolved.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: explicit skill refused; mutation after a live snapshot changes its bytes to after. installSessionCorpusSnapshot skips live snapshots and overlays no skills.\n\nUnresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.\n\nNext action: Shape isolated delivery of frozen skills, support files and declared settings, including omission control and same-name installed skill tests.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-144",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). caseDeclarationSchema rejects setup as an unrecognized key in session-probes.ts; runSessionAttempt only calls seedFixture. sessionUpstreamDigest hashes a static fixture tree.",
    "before": {
      "milestone": null,
      "status": "To Do",
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "status": "Shape",
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. The approved triage fixture needs CLI-built board and git history; static file copying cannot run its setup.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). caseDeclarationSchema rejects setup as an unrecognized key in session-probes.ts; runSessionAttempt only calls seedFixture. sessionUpstreamDigest hashes a static fixture tree.\n\nUnresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.\n\nNext action: Shape the generated-input declaration and realized tree/history freeze with a deterministic fake builder.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-145",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: NO_REPLY, checks=[], attempt directory absent after a fake runner wrote state. session-check.ts supports only reply/tool evidence; sessionAttemptRecordSchema forbids NO_REPLY check results.",
    "before": {
      "milestone": null,
      "status": "To Do",
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "status": "Shape",
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. The experiment grades board and git state; without preserved state a grader correction requires another paid session.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: NO_REPLY, checks=[], attempt directory absent after a fake runner wrote state. session-check.ts supports only reply/tool evidence; sessionAttemptRecordSchema forbids NO_REPLY check results.\n\nUnresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.\n\nNext action: Shape state preservation and command scoring together, including immutable grading inputs, dirty/ignored state, no-reply outcomes, grader errors and scorer identity.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-146",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: valid session reps cause Pipeline comparison rep has no final outcome even with two cases; one-case buildPairedEstimate throws at least two cases.",
    "before": {
      "milestone": null,
      "dependencies": [
        "ACT-140",
        "ACT-143",
        "ACT-144",
        "ACT-145"
      ],
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "dependencies": [
        "ACT-140",
        "ACT-143",
        "ACT-144",
        "ACT-145",
        "ACT-151"
      ],
      "implementationNotes": "Split accounting: ACT-151 owns multi-case compatibility for existing session cases and preserves existing comparison interpretation. Original AC1-6 remain on this card; ACT-151 is a prerequisite contribution to AC1/5, not a retirement or duplicate delivery of single-case statistics, partial scores or the generated-board integration. This releases the earlier ACT-69 experiment without waiting for all four new input/grading capabilities.\n\n## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. A repeated single-case experiment needs session-aware quality and valid uncertainty. Existing two-case support can deliver independently before the estimator decision.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: valid session reps cause Pipeline comparison rep has no final outcome even with two cases; one-case buildPairedEstimate throws at least two cases.\n\nUnresolved claims/resources: Full experiment waits on ACT-140, ACT-143, ACT-144, ACT-145 and the split multi-case compatibility slice. Single-case estimator remains design work.\n\nNext action: Wait for ACT-140, ACT-143, ACT-144, ACT-145, ACT-151. Then Split existing multi-case session compatibility into a prerequisite, then shape one-case uncertainty, named partial results and generated-board integration. Keep original acceptance 1-6 here.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-147",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). No regrade command in src/cli/commands.ts or rehearsal.ts; session-record.ts keeps reply/transcript but no preserved state/check-definition identity. ACT-145 provides the missing state.",
    "before": {
      "milestone": null,
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. Correcting graders on saved evidence avoids repeated provider cost in the approved experiment.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). No regrade command in src/cli/commands.ts or rehearsal.ts; session-record.ts keeps reply/transcript but no preserved state/check-definition identity. ACT-145 provides the missing state.\n\nUnresolved claims/resources: Implementation waits on ACT-145 preserved state; shaping can inspect current schema now.\n\nNext action: After ACT-145, shape evidence-bound reassessment preserving originals and resumed-session boundaries; implement before expensive experiments.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-148",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: tool_result is_error input parses to an empty toolUses record; TranscriptLine exposes only toolUses/outputStyle and no diagnostic result.",
    "before": {
      "milestone": null,
      "status": "To Do",
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "status": "Shape",
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. Observed errors and repeated commands explain the experiment cost using already saved session transcripts.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: tool_result is_error input parses to an empty toolUses record; TranscriptLine exposes only toolUses/outputStyle and no diagnostic result.\n\nUnresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.\n\nNext action: Shape a read-only transcript diagnostic with source locations, prefix exclusion and unavailable-vs-zero semantics.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-149",
    "evidence": "HEAD 3438d1f (product code unchanged from 1d02c8e). sessionAttemptRecordSchema and runSessionDebugAttempt record elapsedMs; comparison-resources.ts ResourceMetricSummary and ResourceMetricEstimates omit it; confirmation-report.ts retains rep durations.",
    "before": {
      "milestone": null,
      "implementationNotes": null
    },
    "after": {
      "milestone": "m-3",
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: medium. Elapsed time distinguishes equally priced variants in the approved experiment; delay is affordable until session comparisons exist.\n\nEvidence: HEAD 3438d1f (product code unchanged from 1d02c8e). sessionAttemptRecordSchema and runSessionDebugAttempt record elapsedMs; comparison-resources.ts ResourceMetricSummary and ResourceMetricEstimates omit it; confirmation-report.ts retains rep durations.\n\nUnresolved claims/resources: Implementation waits on ACT-146 session comparison contract.\n\nNext action: After ACT-146, shape per-attempt elapsed summaries and contrasts, separating provider duration from parallel makespan.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-151",
    "evidence": "session-probes.ts reproduces the session quality rejection; doc-59 and ACT-69 carry the outcome and budget.",
    "before": {
      "implementationNotes": null
    },
    "after": {
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: shaping. Priority: high. Smallest session comparison capability unlocks the existing budgeted m-7 run.\n\nEvidence: session-probes.ts reproduces the session quality rejection; doc-59 and ACT-69 carry the outcome and budget.\n\nUnresolved claims/resources: ACT-140 must establish session group evidence before this implementation.\n\nNext action: Wait for ACT-140, then shape and implement multi-case session evidence loading and quality; preserve ACT-146’s full single-case scope.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  },
  {
    "operation": "edit",
    "id": "ACT-152",
    "evidence": "Read docs/runbook.md against completed ACT-41/44/45 and current preflight/list code.",
    "before": {
      "implementationNotes": null
    },
    "after": {
      "implementationNotes": "## Triage verdict, 2026-09-09 (doc-61)\n\nDisposition: keep; next action: implementation. Priority: medium. The operator guide directs readers around already fixed defects and to one operator’s target path.\n\nEvidence: Read docs/runbook.md against completed ACT-41/44/45 and current preflight/list code.\n\nUnresolved claims/resources: Read-only verification available; paid examples are documentation only.\n\nNext action: Correct the current operator guide and verify its read-only commands against the CLI.\n\nRecord: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>)."
    },
    "state": "read-back verified"
  }
]
```
