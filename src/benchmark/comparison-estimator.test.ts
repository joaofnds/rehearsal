import { describe, expect, it } from "bun:test";
import { buildPairedEstimate } from "./comparison-estimator";

describe(buildPairedEstimate.name, () => {
	it("averages within cases before estimating paired differences", () => {
		const cases = [
			{
				caseId: "case-1",
				minuend: [1, 1],
				subtrahend: [0, 1],
			},
			{
				caseId: "case-2",
				minuend: [1, 1],
				subtrahend: [0, 0],
			},
		];

		const estimate = buildPairedEstimate(cases);

		expect(estimate).toEqual({
			caseDeltas: [
				{ caseId: "case-1", value: 0.5 },
				{ caseId: "case-2", value: 1 },
			],
			meanDelta: 0.75,
			standardError: 0.25,
		});
	});

	it("ignores rep ordinal order within each case arm", () => {
		const cases = [
			{
				caseId: "case-1",
				minuend: [1, 0],
				subtrahend: [1, 0],
			},
			{
				caseId: "case-2",
				minuend: [1, 1],
				subtrahend: [0, 0],
			},
		];

		const forward = buildPairedEstimate(cases);
		const reversed = buildPairedEstimate(
			cases.map((benchmarkCase) => ({
				caseId: benchmarkCase.caseId,
				minuend: benchmarkCase.minuend,
				subtrahend: benchmarkCase.subtrahend.toReversed(),
			})),
		);

		expect(forward).toEqual({
			caseDeltas: [
				{ caseId: "case-1", value: 0 },
				{ caseId: "case-2", value: 1 },
			],
			meanDelta: 0.5,
			standardError: 0.5,
		});
		expect(reversed).toEqual(forward);
	});
});
