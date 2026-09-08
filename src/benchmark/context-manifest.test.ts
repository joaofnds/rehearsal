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
	corpusEntries,
	observedManifest,
	projectEntries,
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
		expect(observedManifest([skillUse("verify")], []).paths).toContainEqual({
			path: "skills/verify/SKILL.md",
			half: "corpus",
		});
	});

	it("names no skill path for a skill only offered, never invoked", () => {
		expect(observedManifest([bashUse()], []).paths).toEqual([]);
	});

	it("names the layout path of a corpus file read directly", () => {
		expect(
			observedManifest([readUse("skills/verify/SKILL.md")], []).paths,
		).toContainEqual({ path: "skills/verify/SKILL.md", half: "corpus" });
	});

	it("names CLAUDE.md read directly, the corpus layout's other kind of path", () => {
		expect(observedManifest([readUse("CLAUDE.md")], []).paths).toContainEqual({
			path: "CLAUDE.md",
			half: "corpus",
		});
	});

	it("names the layout path of a corpus file the session read by its real, absolute path", () => {
		expect(
			observedManifest(
				[readUse("/Users/joaofnds/.claude/skills/verify/SKILL.md")],
				[],
			).paths,
		).toContainEqual({ path: "skills/verify/SKILL.md", half: "corpus" });
	});

	it("names the layout path of a rulebook file read by its real, absolute path", () => {
		expect(
			observedManifest(
				[readUse("/Users/joaofnds/.claude/rulebook/coding-style.md")],
				[],
			).paths,
		).toContainEqual({ path: "rulebook/coding-style.md", half: "corpus" });
	});

	it("names no path for a Read of a file outside the corpus install's .claude layout and outside the declared project files", () => {
		expect(
			observedManifest([readUse("/tmp/attempt/NOTES.md")], [], []).paths,
		).toEqual([]);
	});

	it("tags a declared project file's Read path as project-half, named by its fixture-relative path", () => {
		expect(
			observedManifest([readUse("/tmp/attempt/NOTES.md")], [], ["NOTES.md"])
				.paths,
		).toContainEqual({ path: "NOTES.md", half: "project" });
	});

	it("tags a declared project file's Read path as project-half when the read path is exactly the declared path", () => {
		expect(
			observedManifest([readUse("NOTES.md")], [], ["NOTES.md"]).paths,
		).toContainEqual({ path: "NOTES.md", half: "project" });
	});

	it("tags a Read matching both a corpus layout name and a declared project file's name as corpus-half only, never both", () => {
		const manifest = observedManifest(
			[readUse("/tmp/attempt/.claude/CLAUDE.md")],
			[],
			["CLAUDE.md"],
		);

		expect(manifest.paths).toEqual([{ path: "CLAUDE.md", half: "corpus" }]);
	});

	it("names the last output_style attachment's layout path, not an earlier one", () => {
		expect(observedManifest([], ["brief", "concise"]).paths).toContainEqual({
			path: "output-styles/concise.md",
			half: "corpus",
		});
		expect(observedManifest([], ["brief", "concise"]).paths).not.toContainEqual(
			{ path: "output-styles/brief.md", half: "corpus" },
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
			manifest.paths.filter((entry) => entry.path === "skills/verify/SKILL.md"),
		).toHaveLength(1);
	});
});

describe(reconcileManifest.name, () => {
	it("reports no divergence when the manifest matches the declaration exactly", () => {
		const manifest = observedManifest([skillUse("verify")], ["brief"]);

		expect(
			reconcileManifest(
				manifest,
				corpusEntries(["skills/verify/SKILL.md", "output-styles/brief.md"]),
			),
		).toEqual([]);
	});

	it("reports an undeclared-file divergence for a loaded path the declaration omits", () => {
		const manifest = observedManifest([skillUse("verify")], []);

		expect(reconcileManifest(manifest, [])).toEqual([
			{
				kind: "undeclared-file",
				path: "skills/verify/SKILL.md",
				half: "corpus",
			},
		]);
	});

	it("reports an unloaded-file divergence for a declared path the manifest never shows", () => {
		const manifest = observedManifest([], []);

		expect(
			reconcileManifest(manifest, corpusEntries(["skills/verify/SKILL.md"])),
		).toEqual([
			{ kind: "unloaded-file", path: "skills/verify/SKILL.md", half: "corpus" },
		]);
	});

	it("reports an unloaded-file divergence for a declared rulebook file the session never read", () => {
		const manifest = observedManifest([], []);

		expect(
			reconcileManifest(manifest, corpusEntries(["rulebook/coding-style.md"])),
		).toEqual([
			{
				kind: "unloaded-file",
				path: "rulebook/coding-style.md",
				half: "corpus",
			},
		]);
	});

	it("reports an unloaded-file divergence for a declared project file the session never read, tagged project-half", () => {
		const manifest = observedManifest([], [], []);

		expect(
			reconcileManifest(manifest, [{ path: "NOTES.md", half: "project" }]),
		).toEqual([{ kind: "unloaded-file", path: "NOTES.md", half: "project" }]);
	});

	it("reports an undeclared-file divergence for a project-half Read the case never declared, tagged project-half", () => {
		const manifest = observedManifest(
			[readUse("/tmp/attempt/NOTES.md")],
			[],
			["NOTES.md"],
		);

		expect(reconcileManifest(manifest, [])).toEqual([
			{ kind: "undeclared-file", path: "NOTES.md", half: "project" },
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

		const manifest = observedManifest(uses, styles, declaration.projectFiles);

		expect(
			manifest.paths.toSorted((left, right) =>
				left.path.localeCompare(right.path),
			),
		).toEqual([
			{ path: "NOTES.md", half: "project" },
			{ path: "output-styles/brief.md", half: "corpus" },
			{ path: "skills/verify/SKILL.md", half: "corpus" },
		]);
		expect(
			reconcileManifest(manifest, [
				...corpusEntries(declaration.corpusFiles),
				...projectEntries(declaration.projectFiles),
			]),
		).toEqual([]);
	});
});
