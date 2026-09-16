# Independent review record

Review scope: the [Promptfoo study](../promptfoo-study.md), its supporting
architecture/proposals/evidence documents, and its documentation-index entry.
The review used the revisions recorded in [evidence](evidence.md). The reviewer
received the user's goal, artifact paths, source checkouts, and verification
locations without the author's assessment. Review-docs supplied the criteria;
adversarial-review supplied the independent review procedure.

## Reviewer report, verbatim

Review completed read-only. No edits, mutating commands, paid-provider calls, or browser interactions.

**Blocking: none.**

**Should-fix — Retry preservation wording conflates command failure with repeated cell failure.**

Location: `docs/promptfoo-study/architecture.md:160–161`.

The statement that retry “preserves them if retry fails” is too broad. Original error rows survive an exception from the evaluation or a persistence failure. They do not necessarily survive another unsuccessful provider attempt.

Concrete counterexample: a retried provider returns `{error: "provider unavailable"}`. Promptfoo’s evaluator records an unsuccessful `ERROR` cell without throwing (`src/evaluator.ts:1342–1346`). If evaluation completes and persists that replacement error, `retryCommand` proceeds directly to deleting the original error IDs (`src/node/retry.ts:408–420`). It does not require replacement cells to pass or become error-free.

Clarify that deletion follows completion and persistence of the retry operation, while orchestration/persistence failures preserve originals. A repeated cell error can replace its predecessor. This supports the study’s recommendation to retain linked attempts, but changes the evidence readers should take from Promptfoo’s failure behavior.

Verification: **command-verified source inspection; the counterexample follows from the inspected branches, rather than an executed retry probe.**

Commands:

```sh
nl -ba docs/promptfoo-study/architecture.md | sed -n '155,178p'
nl -ba /tmp/rehearse-promptfoo-study/src/node/retry.ts | sed -n '403,430p'
nl -ba /tmp/rehearse-promptfoo-study/src/evaluator.ts | sed -n '1338,1357p'
sed -n '630,675p' /tmp/rehearse-promptfoo-study/test/node/retry.test.ts
```

The existing tests inspected corroborate preservation when `evaluate` rejects and when `resultPersistenceFailed` is true; those are narrower conditions than unsuccessful replacement cells.

**Notes: none.**

Reviewed sources included the complete synthesis, architecture, proposals, evidence record, and documentation index; Rehearse’s status, vision, research, accepted roadmap sections, prior-study provider decision, session input freezing, reliability estimator, paired estimator, and confirmation scheduler; Promptfoo’s assertion aggregation, comparison matcher, repeat cache tests and implementation, optimizer partition/selection, retry implementation/tests, Claude usage/defaults, Codex app-server defaults/policy, trajectory assertions, agent-rubric matcher/docs, coding-agent verifier code, and strict-generation CLI option. The late grading/security/arm-order additions were included.

Both repository SHAs matched the stated pins. Reading the two raw probe JSON files confirmed the documented row counts, success counts, threshold score, and component verdicts. A read-only link-target check found no missing referenced local files or pinned Promptfoo source paths.

Material gaps: I did not independently rerun the recorded test suites or CLI probes; raw JSON does not establish their recorded process exit codes. I did not validate live agent fidelity, commercial behavior, browser usability, statistical coverage, or crash/resource behavior. These remain appropriately identified limitations in the study.

## Disposition

**Fixed.** The architecture paragraph now distinguishes a completed and persisted
retry operation from successful replacement cells. Original errors may be
replaced by new errors; evaluation exceptions and detected persistence failures
preserve originals. No recommendation or product code changed.

The author reread the named evaluator and retry branches and the corrected
paragraph with `sed -n '157,171p'` on the architecture document,
`sed -n '407,420p'` on `src/node/retry.ts`, and `sed -n '1340,1348p'` on
`src/evaluator.ts`. The branches support the revised wording. This was a source
probe, not an additional executed retry experiment. The temporary clone paths
in the raw review commands are reproducibility locations; substitute any
checkout of the pinned Promptfoo revision.

## Follow-up reviewer report, verbatim

No remaining defect in the correction. The paragraph now distinguishes evaluation exceptions or detected persistence failures from completed retries that record another provider-error cell.

Command-verified by rereading the corrected paragraph and the specified `retry.ts` and `evaluator.ts` branches. The should-fix finding is resolved. No blocking findings or notes.

## Final disposition

Proceed after the limited follow-up confirmed the correction. No review finding
remains open. Study uncertainties stay in the evidence and proposal documents;
closing this finding does not validate live runtimes or statistical coverage.
