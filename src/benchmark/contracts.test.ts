import { describe, expect, it } from "bun:test";
import type { JudgeGrade } from "./contracts";
import { claudeJsonSchema, stageTurnSchema } from "./contracts";
import { validateJudgeGrade } from "./judge";

const RUBRIC_IDS = [
	"tests",
	"worker",
	"check-integrity",
	"local-checks",
] as const;

function completeGrade(verdict: "PASS" | "FAIL"): JudgeGrade {
	return {
		requirements: RUBRIC_IDS.map((id) => requirement(id, verdict)),
		verdict,
		summary: "complete",
	};
}

function requirement(
	id: string,
	status: "PASS" | "FAIL",
): JudgeGrade["requirements"][number] {
	return {
		id,
		status,
		evidence: [
			{
				source: "diff",
				path: "src/audit/example.ts",
				claim: `${id} evidence`,
			},
		],
	};
}

function withFirstRequirement(
	grade: JudgeGrade,
	first: JudgeGrade["requirements"][number],
): JudgeGrade {
	return { ...grade, requirements: [first, ...grade.requirements.slice(1)] };
}

describe(validateJudgeGrade.name, () => {
	it("accepts a complete consistent grade", () => {
		const grade = completeGrade("PASS");

		expect(validateJudgeGrade(grade, RUBRIC_IDS)).toEqual(grade);
	});

	it("rejects a verdict that contradicts requirement results", () => {
		const grade = withFirstRequirement(
			completeGrade("PASS"),
			requirement(RUBRIC_IDS[0], "FAIL"),
		);

		expect(() => validateJudgeGrade(grade, RUBRIC_IDS)).toThrow(
			"contradicts requirement results",
		);
	});

	it("rejects an incomplete grade", () => {
		const base = completeGrade("PASS");
		const grade = { ...base, requirements: base.requirements.slice(0, -1) };

		expect(() => validateJudgeGrade(grade, RUBRIC_IDS)).toThrow(
			"every rubric requirement exactly once",
		);
	});

	it("accepts requirements added to the rubric without a code change", () => {
		const base = completeGrade("PASS");
		const grade = {
			...base,
			requirements: [...base.requirements, requirement("human-review", "PASS")],
		};

		const validated = validateJudgeGrade(grade, [
			...RUBRIC_IDS,
			"human-review",
		]);

		expect(validated).toEqual(grade);
	});
});

describe(claudeJsonSchema.name, () => {
	it("omits the $schema key Claude rejects", () => {
		expect(claudeJsonSchema(stageTurnSchema)).not.toContain('"$schema"');
	});
});
