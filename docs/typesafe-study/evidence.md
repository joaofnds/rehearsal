# TypeSafe study: evidence and reproducibility

This record supports the [study](../typesafe-study.md). Research was conducted on
**2026-09-17**. The conclusions separate documented capabilities, inspected
implementation, locally exercised behavior, and proposals requiring live data.

The product owner's confirmed direction is a mixture of deterministic judges,
Jev judges, and other LLM judges. This is a task constraint, not a finding from
vendor research. The study's shared-record design and composition experiment are
proposals within that direction. The source revisions and probe results below
describe the original technical investigation; reframing the proposal adds no
live inference evidence.

## Provenance

| Source                           | Revision or date                                            | Method                                                                                            |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Rehearse                         | `5fc9fd42d0e3e5555b3207a9ee0d9b50a8ee494d`                  | Local source inspection; clean initial worktree.                                                  |
| Official TypeSafe JavaScript SDK | `66880ccded6cb642dc1809620c2b108c33730214`, package `0.6.0` | Public shallow clone, source inspection, mock-transport execution under Bun 1.4.0 on macOS arm64. |
| TypeSafe documentation           | Retrieved 2026-09-17                                        | Documentation index, HTML pages, and corresponding public Markdown exports.                       |
| Vendor launch report             | Dated 2026-09-15                                            | Public report and linked workflow evaluation pages.                                               |
| Competing products               | Official documentation retrieved 2026-09-17                 | Targeted comparison of extensibility, model grading, calibration, and human review.               |

Commands establishing the code revisions were `git rev-parse HEAD`,
`git -C /tmp/rehearse-typesafe-study/sdk-js rev-parse HEAD`, and inspection of
the SDK's `package.json`. Temporary downloads and the SDK checkout were kept
outside Rehearse. No dependency, production code, case fixture, product vision,
or roadmap file was changed by this study.

The environment had no `TYPESAFE_API_KEY`; only its presence was checked, without
printing secrets or searching credential stores. No account was created, no
paid inference was invoked, and no private code or transcript was sent to
TypeSafe. Research completion does not imply successful live integration.

## Load-bearing repository evidence

Paths below resolve against the pinned Rehearse revision. Line numbers are
discovery aids; the named function or schema is the durable reference.

| Finding                                                                        | Source                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session checks operate on reply/tool evidence                                  | [`session-check.ts`](../../src/benchmark/session-check.ts), `evaluateChecks`; [`session-record.ts`](../../src/benchmark/session-record.ts), session result schema.                                                 |
| Final filesystem preservation is not an implemented session outcome contract   | [`status.md`](../status.md#known-limitations); [`session-attempt.ts`](../../src/benchmark/session-attempt.ts), cleanup and result construction.                                                                    |
| Stage Judge receives frozen supplied evidence and uses sealed access           | [`contracts.ts`](../../src/benchmark/contracts.ts), `StageJudgeInput` around line 282; [`stage-grading.ts`](../../src/benchmark/stage-grading.ts), `runStageJudge` around line 278.                                |
| Hard blockers, requirements, and dimensions have distinct grade semantics      | [`stage-grading.ts`](../../src/benchmark/stage-grading.ts), `deriveStageGrade` and `applyAuthoritativeStageResults`, lines 80–170.                                                                                 |
| Final Judge enforces exact requirement IDs and harness overrides               | [`judge.ts`](../../src/benchmark/judge.ts), `validateJudgeGrade`, `applyHarnessResults`.                                                                                                                           |
| Evidence validation checks source availability rather than semantic entailment | [`judge.ts`](../../src/benchmark/judge.ts), `validateJudgeEvidence`; [`stage-grading.ts`](../../src/benchmark/stage-grading.ts), `validateStageJudgeEvidence`.                                                     |
| Output requires evidence claims and a summary                                  | [`contracts.ts`](../../src/benchmark/contracts.ts), `judgeGradeSchema` and `stageJudgeOutputSchema`.                                                                                                               |
| The injectable transport still expects Claude output                           | [`judge-attempt.ts`](../../src/benchmark/judge-attempt.ts), `JudgeInvoker`, `runJudgeAttempts`, and calls to `readClaudeEnvelope`.                                                                                 |
| Unmentioned human findings inherit the Judge decision                          | [`judge-agreement.ts`](../../src/benchmark/judge-agreement.ts), `humanDecision`, lines 177–201.                                                                                                                    |
| Agreement identity is narrower than a complete grading condition               | [`judge-agreement.ts`](../../src/benchmark/judge-agreement.ts), `baselineKey`, around line 474: model, stage, rubric hash.                                                                                         |
| Comparison controls include Judge model and effort                             | [`comparison-comparability.ts`](../../src/benchmark/comparison-comparability.ts), lines 249–253.                                                                                                                   |
| Current dimensions are not complete Jev level definitions                      | [`shape.json`](../../cases/audit-log/rubrics/shape.json) and [`build.json`](../../cases/audit-log/rubrics/build.json) provide `good` and `excellent` anchors; other letter anchors are not supplied per dimension. |

These were read with `rg`, `sed`, and direct file reads. Inspection of the
human-decision branch confirms the study's calibration concern: it returns the
Judge decision when no explicit matching finding overrides it. This is a source
finding, not a measured estimate of inflated agreement on a labeled dataset.

## Vendor source coverage

The [documentation index](https://docs.typesafe.ai/llms.txt) was used to locate
the following source groups. The study links claims directly to their supporting
pages; these groups record coverage without reproducing vendor documentation.

- Input/output semantics: [introduction](https://docs.typesafe.ai/introduction),
  [System One](https://docs.typesafe.ai/concepts/system-one),
  [state](https://docs.typesafe.ai/concepts/state),
  [Choice](https://docs.typesafe.ai/primitives/choice),
  [Score](https://docs.typesafe.ai/primitives/score),
  [Noul](https://docs.typesafe.ai/primitives/noul),
  [confidence](https://docs.typesafe.ai/confidence),
  [API](https://docs.typesafe.ai/api).
- Operation and limits: [models](https://docs.typesafe.ai/models),
  [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13),
  [SDK](https://docs.typesafe.ai/sdk/javascript), and pinned SDK code.
- Evidence for performance: [launch report](https://typesafe.ai/blog/introducing-system-one-models-and-jev),
  [workflow methodology](https://evals.typesafe.ai/),
  [agent-trace example](https://evals.typesafe.ai/agent_trace_observability),
  [Noul consistency](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook),
  [Choice consistency](https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook),
  [citation checks](https://docs.typesafe.ai/cookbooks/citation_check),
  [extraction cascade](https://docs.typesafe.ai/cookbooks/sde_cascade).
- Data handling: [legal index](https://docs.typesafe.ai/legal),
  [privacy](https://typesafe.ai/legal/privacy-policy),
  [DPA](https://typesafe.ai/legal/data-processing),
  [customer agreement](https://typesafe.ai/legal/mca).

Some documentation pages failed in the browser-text retrieval tool. Their
published `.md` versions, including `models.md`, `legal.md`, and
`model-jaggedness/jev-1.13.md`, were retrieved with Python's `urllib.request`.
The limitations page identifies itself as last reviewed 2026-09-16.
The workflow site was readable through the web tool, while direct HTTP retrieval
returned 403. Its interactive plots and underlying per-example data were not
independently reproduced. No reported vendor accuracy or speed result is
presented as a local measurement.

The citation cookbook reports an older Jev version and uses cached example
results. The consistency cookbook uses one claim and changing input IDs. These
are illustrations with narrower scope than independent held-out calibration.

The reviewed API and SDK interfaces do not expose a documented seed or
temperature parameter. The study therefore makes no exact-repeatability claim.
Version pinning is documented, but version availability guarantees and service
SLAs for the intended account were not established.

## Local SDK probe

The probe used the SDK's **source entry point**, not an installed package build.
It passed an injected `fetch` that returned synthetic responses and never used
network transport. Run from the Rehearse checkout:

```sh
git clone https://github.com/typesafe-ai/typesafe-sdk-js.git /tmp/rehearse-typesafe-study/sdk-js
git -C /tmp/rehearse-typesafe-study/sdk-js checkout 66880ccded6cb642dc1809620c2b108c33730214
mise exec -- bun /tmp/rehearse-typesafe-study/probe.ts
```

Save the TypeScript block below as `/tmp/rehearse-typesafe-study/probe.ts` first.
Use a fresh temporary directory or an existing checkout at the stated revision.
The completed local run exited 0 and returned:

```json
{
	"runtime": "1.4.0",
	"mixedQuestions": "pass",
	"explicitModel": "pass",
	"fractionalScore": "pass",
	"missingAnswersAcceptedBySDK": true,
	"overloadedRetryAttempts": 2,
	"networkCalls": 0
}
```

The missing-answer check intentionally returns an incomplete successful HTTP
response. The SDK accepts it; the compile-time answer type does not validate the
payload. This is confirmed by `return parsed as T` in the pinned
[client](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/client.ts#L342).
It does **not** show that the real service returns incomplete answers. It shows
why an evidence-preserving harness still validates its external boundary.

The overload check exercises one synthetic 529 followed by a successful response.
It does not test production rate limits, billing, cancellation, or deployment
behavior. The initial probe assertion was corrected to account for ordinary JSON
serialization omitting an undefined optional field; no SDK change was needed.

## Arithmetic checks

The price examples use `input_tokens / 1_000_000 * 0.042`. The illustrative
whole-run saving uses `1 - ((1 - 0.1) + 0.1 / 100) = 0.099`.
The exact one-sided binomial upper bound for zero observed errors in 100
independent trials is `1 - 0.05 ** (1 / 100)`, approximately 0.0295. These
calculations were independently evaluated locally. They are not measured cost
savings or error rates.

## Remaining empirical gaps

The study does not establish live API access, package-distribution compatibility,
real model identity in responses, in-domain accuracy, calibration, injection
resistance, error independence, latency, usage/billing behavior, fallback
frequency, or end-to-end product benefit. It also does not establish the account's
contractual retention period or a commitment to retain older model versions.

These gaps bound the recommendation to an optional trial. They are not reasons
to replace existing grades or present a vendor distribution as confirmation of
an instruction's effect. No full Rehearse test suite was run for this
documentation-only change; local evidence, links, formatting, arithmetic, and
the mock probe were the relevant checks.

The [independent review record](review.md) preserves findings and dispositions.

## Probe source

```typescript
import { strict as assert } from "node:assert";
import { TypeSafeClient, choice, noul, score } from "./sdk-js/src/index.ts";

const questions = {
	supported: choice("Does the supplied source support the claim?", {
		supported: "Source supports the claim",
		contradicted: "Source contradicts the claim",
		insufficient: "Supplied evidence does not settle the claim",
	}),
	observable: score("How directly observable is this acceptance criterion?", [
		"No observable result",
		"Observable result with missing conditions",
		"Observable result with explicit conditions and expected outcome",
	]),
	claimsSuccess: noul("Does the reply claim successful execution?"),
};
let payload: any;
const response = {
	model: "jev-1.13.0",
	answers: {
		supported: {
			type: "choice",
			choice: "contradicted",
			confidence: 0.8,
			probabilities: { supported: 0.05, contradicted: 0.9, insufficient: 0.05 },
		},
		observable: {
			type: "score",
			score: 1.6,
			confidence: 0.7,
			probabilities: { "0": 0.1, "1": 0.2, "2": 0.7 },
			legend: {
				"0": questions.observable.criteria[0],
				"1": questions.observable.criteria[1],
				"2": questions.observable.criteria[2],
			},
		},
		claimsSuccess: { type: "noul", noul: 0.95 },
	},
	usage: { input_tokens: 500, output_tokens: 30 },
};
const client = new TypeSafeClient({
	apiKey: "synthetic-local-only",
	defaultModel: "jev-1.13.0",
	fetch: async (url, init) => {
		assert.equal(url, "https://api.typesafe.ai/v1/systemone");
		payload = JSON.parse(String(init?.body));
		return Response.json(response);
	},
});
const result = await client.systemOne({
	state: { reply: "All tests passed", exitCode: 1 },
	questions,
});
assert.equal(payload.model, "jev-1.13.0");
assert.deepEqual(payload.questions, JSON.parse(JSON.stringify(questions)));
assert.equal(result.answers.observable.score, 1.6);
assert.equal(result.answers.supported.choice, "contradicted");
const malformedClient = new TypeSafeClient({
	apiKey: "synthetic-local-only",
	fetch: async () =>
		Response.json({
			model: "jev-1.13.0",
			answers: {},
			usage: { input_tokens: 1, output_tokens: 0 },
		}),
});
const malformed = await malformedClient.systemOne({
	state: "example",
	questions,
});
assert.equal(malformed.answers.supported, undefined);
let attempts = 0;
const retryClient = new TypeSafeClient({
	apiKey: "synthetic-local-only",
	retry: { backoffInitialMs: 0, backoffMaxMs: 0 },
	fetch: async () =>
		++attempts === 1
			? Response.json({ error: "busy" }, { status: 529 })
			: Response.json(response),
});
await retryClient.systemOne({ state: "example", questions });
assert.equal(attempts, 2);
console.log(
	JSON.stringify({
		runtime: Bun.version,
		mixedQuestions: "pass",
		explicitModel: "pass",
		fractionalScore: "pass",
		missingAnswersAcceptedBySDK: true,
		overloadedRetryAttempts: attempts,
		networkCalls: 0,
	}),
);
```
