import { describe, expect, it } from "bun:test";
import type { HashedFile } from "#benchmark/checkpoint";
import { comparisonAttribution } from "./comparison-attribution";

function file(path: string, sha256: string): HashedFile {
	return { path, sha256 };
}

describe(comparisonAttribution.name, () => {
	it("claims attribution when every deduplicated file hash agrees between the two arms", () => {
		const left = [
			file("CLAUDE.md", "a".repeat(64)),
			file("CLAUDE.md", "a".repeat(64)),
		];
		const right = [
			file("CLAUDE.md", "a".repeat(64)),
			file("CLAUDE.md", "a".repeat(64)),
		];

		const result = comparisonAttribution(left, right);

		expect(result).toEqual({ claim: "identical" });
	});

	it("counts a file read at two stages once, not twice, when it differs", () => {
		const left = [
			file("CLAUDE.md", "a".repeat(64)),
			file("CLAUDE.md", "a".repeat(64)),
		];
		const right = [
			file("CLAUDE.md", "b".repeat(64)),
			file("CLAUDE.md", "b".repeat(64)),
		];

		const result = comparisonAttribution(left, right);

		expect(result).toEqual({ claim: "refused", differingPaths: ["CLAUDE.md"] });
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

		const result = comparisonAttribution(left, right);

		expect(result).toEqual({
			claim: "refused",
			differingPaths: ["CLAUDE.md", "skills/build/SKILL.md"],
		});
	});

	it("treats a file present in only one arm's corpus as a difference", () => {
		const left = [file("CLAUDE.md", "a".repeat(64))];
		const right = [
			file("CLAUDE.md", "a".repeat(64)),
			file("skills/discuss/SKILL.md", "a".repeat(64)),
		];

		const result = comparisonAttribution(left, right);

		expect(result).toEqual({
			claim: "refused",
			differingPaths: ["skills/discuss/SKILL.md"],
		});
	});

	it("claims attribution for a file edited identically across every stage's own corpus copy", () => {
		const left = [
			file("inputs/corpus/discuss/CLAUDE.md", "a".repeat(64)),
			file("inputs/corpus/build/CLAUDE.md", "a".repeat(64)),
		];
		const right = [
			file("inputs/corpus/discuss/CLAUDE.md", "b".repeat(64)),
			file("inputs/corpus/build/CLAUDE.md", "b".repeat(64)),
		];

		const result = comparisonAttribution(left, right);

		expect(result).toEqual({
			claim: "refused",
			differingPaths: ["CLAUDE.md"],
		});
	});
});
