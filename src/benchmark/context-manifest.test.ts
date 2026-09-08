import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { casesRoot, readCaseDeclaration } from "#benchmark/case";
import type { ToolUse } from "#benchmark/transcript";
import {
	outputStyles,
	parseTranscript,
	parseTranscriptFile,
	toolUses,
} from "#benchmark/transcript";
import {
	observedManifest,
	reconcileManifest,
} from "#benchmark/context-manifest";

function skillUse(skill: string): ToolUse {
	return { type: "tool_use", name: "Skill", input: { skill } };
}

function readUse(filePath: string): ToolUse {
	return { type: "tool_use", name: "Read", input: { file_path: filePath } };
}

function bashUse(): ToolUse {
	return { type: "tool_use", name: "Bash", input: { command: "ls" } };
}

describe(observedManifest.name, () => {
	it("names the layout path of every skill invoked", () => {
		expect(observedManifest([skillUse("verify")], []).paths).toContain(
			"skills/verify/SKILL.md",
		);
	});

	it("names no skill path for a skill only offered, never invoked", () => {
		expect(observedManifest([bashUse()], []).paths).toEqual([]);
	});

	it("names the layout path of a corpus file read directly", () => {
		expect(
			observedManifest([readUse("skills/verify/SKILL.md")], []).paths,
		).toContain("skills/verify/SKILL.md");
	});

	it("names the last output_style attachment's layout path, not an earlier one", () => {
		expect(observedManifest([], ["brief", "concise"]).paths).toContain(
			"output-styles/concise.md",
		);
		expect(observedManifest([], ["brief", "concise"]).paths).not.toContain(
			"output-styles/brief.md",
		);
	});

	it("names no output-style path for a transcript with no output_style attachment", () => {
		expect(observedManifest([], []).paths).toEqual([]);
	});

	it("deduplicates a path reached by more than one route", () => {
		const manifest = observedManifest(
			[skillUse("verify"), readUse("skills/verify/SKILL.md")],
			[],
		);

		expect(
			manifest.paths.filter((path) => path === "skills/verify/SKILL.md"),
		).toHaveLength(1);
	});
});

describe(reconcileManifest.name, () => {
	it("reports no divergence when the manifest matches the declaration exactly", () => {
		const manifest = observedManifest([skillUse("verify")], ["brief"]);

		expect(
			reconcileManifest(manifest, [
				"skills/verify/SKILL.md",
				"output-styles/brief.md",
			]),
		).toEqual([]);
	});

	it("reports an undeclared-file divergence for a loaded path the declaration omits", () => {
		const manifest = observedManifest([skillUse("verify")], []);

		expect(reconcileManifest(manifest, [])).toEqual([
			{ kind: "undeclared-file", path: "skills/verify/SKILL.md" },
		]);
	});

	it("reports an unloaded-file divergence for a declared path the manifest never shows", () => {
		const manifest = observedManifest([], []);

		expect(reconcileManifest(manifest, ["skills/verify/SKILL.md"])).toEqual([
			{ kind: "unloaded-file", path: "skills/verify/SKILL.md" },
		]);
	});
});

describe("a transcript record of an unrecognized type", () => {
	it("yields no manifest entry and no divergence, never a failed attempt", () => {
		const transcript = parseTranscript(
			JSON.stringify({
				type: "future-record-kind",
				payload: { skill: "verify" },
			}),
		);
		const manifest = observedManifest(
			toolUses(transcript),
			outputStyles(transcript),
		);

		expect(manifest.paths).toEqual([]);
		expect(reconcileManifest(manifest, [])).toEqual([]);
	});
});

describe("over the manifest-probe fixture", () => {
	it("builds the manifest from disk records alone and reconciles it against the case's declaration", async () => {
		const declaration = await readCaseDeclaration("manifest-probe");
		if (
			declaration.kind !== "session" ||
			declaration.transcript === undefined
		) {
			throw new Error(
				"manifest-probe is expected to be a session case with a transcript",
			);
		}

		const transcriptPath = join(
			casesRoot(),
			"manifest-probe",
			declaration.transcript.file,
		);
		const transcript = await parseTranscriptFile(transcriptPath);
		const uses = toolUses(transcript);
		const styles = outputStyles(transcript);

		const manifest = observedManifest(uses, styles);

		expect(manifest.paths.toSorted()).toEqual([
			"output-styles/brief.md",
			"skills/verify/SKILL.md",
		]);
		expect(reconcileManifest(manifest, declaration.corpusFiles)).toEqual([]);
	});
});
