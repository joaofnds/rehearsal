import { describe, expect, it } from "bun:test";
import type { HashedFile } from "#benchmark/checkpoint";
import { comparisonAttribution } from "./comparison-attribution";

function file(path: string, sha256: string): HashedFile {
	return { path, sha256 };
}

describe(comparisonAttribution.name, () => {
	it("reports identical when every deduplicated file hash agrees between the two arms", () => {
		const left = [
			file("CLAUDE.md", "a".repeat(64)),
			file("CLAUDE.md", "a".repeat(64)),
		];
		const right = [
			file("CLAUDE.md", "a".repeat(64)),
			file("CLAUDE.md", "a".repeat(64)),
		];

		const result = comparisonAttribution(left, right, "pipeline");

		expect(result).toEqual({ claim: "identical" });
	});

	it("attributes a file read at two stages once when it is the sole difference", () => {
		const left = [
			file("CLAUDE.md", "a".repeat(64)),
			file("CLAUDE.md", "a".repeat(64)),
		];
		const right = [
			file("CLAUDE.md", "b".repeat(64)),
			file("CLAUDE.md", "b".repeat(64)),
		];

		const result = comparisonAttribution(left, right, "pipeline");

		expect(result).toEqual({
			claim: "attributable",
			differingPath: "CLAUDE.md",
		});
	});

	it("lists every distinct differing path, sorted, when more than one file differs", () => {
		const left = [
			file("CLAUDE.md", "a".repeat(64)),
			file("skills/build/SKILL.md", "a".repeat(64)),
		];
		const right = [
			file("CLAUDE.md", "b".repeat(64)),
			file("skills/build/SKILL.md", "c".repeat(64)),
		];

		const result = comparisonAttribution(left, right, "pipeline");

		expect(result).toEqual({
			claim: "refused",
			differingPaths: ["CLAUDE.md", "skills/build/SKILL.md"],
		});
	});

	it("attributes a file present in only one arm's corpus", () => {
		const left = [file("CLAUDE.md", "a".repeat(64))];
		const right = [
			file("CLAUDE.md", "a".repeat(64)),
			file("skills/discuss/SKILL.md", "a".repeat(64)),
		];

		const result = comparisonAttribution(left, right, "pipeline");

		expect(result).toEqual({
			claim: "attributable",
			differingPath: "skills/discuss/SKILL.md",
		});
	});

	it("attributes one file edited identically across every stage's corpus copy", () => {
		const left = [
			file("inputs/corpus/discuss/CLAUDE.md", "a".repeat(64)),
			file("inputs/corpus/build/CLAUDE.md", "a".repeat(64)),
		];
		const right = [
			file("inputs/corpus/discuss/CLAUDE.md", "b".repeat(64)),
			file("inputs/corpus/build/CLAUDE.md", "b".repeat(64)),
		];

		const result = comparisonAttribution(left, right, "pipeline");

		expect(result).toEqual({
			claim: "attributable",
			differingPath: "CLAUDE.md",
		});
	});

	it("keeps session corpus layout categories with the same basename distinct", () => {
		const left = [file("inputs/corpus/agents/team.md", "a".repeat(64))];
		const right = [file("inputs/corpus/output-styles/team.md", "a".repeat(64))];

		const result = comparisonAttribution(left, right, "session");

		expect(result).toEqual({
			claim: "refused",
			differingPaths: ["agents/team.md", "output-styles/team.md"],
		});
	});
});
