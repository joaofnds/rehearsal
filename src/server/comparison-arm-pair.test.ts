import { describe, expect, it } from "bun:test";
import { armPairLabel, armPairs, pairKey } from "./comparison-arm-pair";

describe(pairKey.name, () => {
	it("builds a PascalCase-subtrahend key from two arm names", () => {
		expect(pairKey("candidate", "baseline")).toBe("candidateMinusBaseline");
	});
});

describe(armPairLabel.name, () => {
	it.each([
		["candidateMinusBaseline", "candidate vs baseline"],
		["baselineMinusControl", "baseline vs control"],
		["candidateMinusControl", "candidate vs control"],
	])("decodes %s into %s", (pair, label) => {
		expect(armPairLabel(pair)).toBe(label);
	});
});

describe(armPairs.name, () => {
	it("returns the report's three canonical contrasts, not every ordered pair", () => {
		expect(armPairs()).toEqual([
			{ minuend: "candidate", subtrahend: "baseline" },
			{ minuend: "candidate", subtrahend: "control" },
			{ minuend: "baseline", subtrahend: "control" },
		]);
	});
});
