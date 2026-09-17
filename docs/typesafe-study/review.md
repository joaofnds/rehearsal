# Independent review record

Scope: the [TypeSafe study](../typesafe-study.md), its
[evidence record](evidence.md), and the added documentation-index entry.
Review-docs supplied the document criteria and adversarial-review supplied the
independent review procedure. The reviewer received the user's research request,
artifact paths, source locations, and reproduction commands without the author's
assessment.

## Reviewer report, verbatim

Blocking: none.

Should-fix:

1. **Separate challenge-set results from estimates of normal workload coverage and cost.** Location: `docs/typesafe-study.md:376–387` (“Dataset and reference”) and `:408–425` (“Measurements and decision gates”). The proposed holdout deliberately includes failures and adversarial variants, then uses calibration, automatic coverage, fallback-inclusive cost, and latency to inform promotion. Its sampling distribution is unspecified. These measurements depend on the prevalence and difficulty of examples, even within one criterion. Holding examples out prevents tuning leakage; it does not make an enriched challenge set representative.

   Concrete counterexample: a policy that escalates 80% of failures and 10% of successes has a 45% fallback rate in a half-failure challenge set, but 13.5% when failures comprise 5% of normal traffic. Neither the model nor its conditional behavior changed. Estimated fallback cost and coverage changed substantially. Likewise, calibration measured on an artificially balanced set cannot automatically establish calibration for normal traffic.

   Keep the adversarial challenge set, but identify it separately from a workload-representative sample. Predeclare sampling or weighting by intended criterion/task mix before estimating operational coverage, fallback cost, or calibration. If representative sampling is deferred to the fresh-run phase, explicitly restrict the first phase’s conclusions and make that validation a prerequisite for authoritative promotion.

   **Evidence:** methodological reasoning; illustrative arithmetic command-verified:

   ```sh
   python3 - <<'PY'
   for failure_share in (0.5, 0.05):
       print(failure_share * 0.8 + (1 - failure_share) * 0.1)
   PY
   ```

   Output: `0.45`, `0.135`.

Notes: none.

Verification and examined context:

- Read all three affected documents, `CLAUDE.md`, `CONTRIBUTING.md`, and the vision, status, architecture, and neighboring study introductions.
- Inspected session checks and record/cleanup boundaries; final and stage Judge contracts, invocation, validation, authoritative overrides, and grade derivation; human-agreement construction and identity; comparison controls; and the shape/build rubrics.
- Verified the pinned repository and SDK revisions. Inspected SDK package metadata, question transport, response parsing, and retry handling.
- Ran `mise exec -- bun /tmp/rehearse-typesafe-study/probe.ts`; it reproduced the documented successful result. Also extracted the currently formatted embedded probe into `/tmp/rehearse-typesafe-study/review-embedded-probe.ts` and ran it successfully. Both used mock transport.
- Recomputed the price examples, 9.9% illustrative saving, and approximately 2.95% binomial upper bound.
- Independently checked official TypeSafe introduction, API/primitives/confidence/model-limit material, [launch report](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [workflow methodology](https://evals.typesafe.ai/), consistency examples, privacy/DPA material, and the cited official competitor documentation. The study appropriately distinguishes documented capabilities, vendor demonstrations, local transport evidence, and untested model quality.
- Local links resolved except the forthcoming `typesafe-study/review.md`, which must exist when the review record is delivered.

Material gaps: no live inference, package-distribution execution, billing, in-domain calibration, or operational latency was independently tested. Vendor interactive plots and underlying per-example datasets were not reproduced. These limits are disclosed and do not invalidate the recommendation for a bounded trial.

## Disposition

**Fixed.** The dataset section now distinguishes the enriched challenge set from
a separate workload-representative sample with predeclared sampling or weights.
First-phase conclusions are limited to further experimentation until
representative validation exists. The promotion gate requires both robustness
on the held-out challenge set and support for calibration, error tolerance, and
operational benefit on the intended workload.

The author reran the reviewer's arithmetic command and obtained `0.45` and
`0.135`, then reread the amended dataset and promotion sections. The study now
includes that counterexample to explain the distinction. The review-record file
also resolves the pending local link.

Proceed after this correction; no additional review round was requested. The
finding changes the proposed experiment, not the technical feasibility verdict
or observed product behavior. No review finding remains open. Live model quality
and operational benefits remain unmeasured as described in the evidence record.
