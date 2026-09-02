import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionCase } from "#benchmark/case";
import type { SessionSettings } from "#benchmark/claude";
import type { ResolvedCorpusFile } from "#benchmark/corpus-file";
import { sessionLineage } from "#benchmark/session-lineage";

const settings: SessionSettings = {
	model: "haiku",
	effort: "low",
	budgetUsd: 0.2,
};

function sessionCase(fixturePath?: string): SessionCase {
	return {
		kind: "session",
		declaration: {
			id: "probe",
			kind: "session",
			title: "Probe",
			prompt: "Reply with the single word OK.",
			tools: [],
			corpusFiles: ["output-styles/brief.md"],
			checks: [{ kind: "word-band", max: 1 }],
		},
		fixturePath,
		transcriptPath: undefined,
		prompt: "Reply with the single word OK.",
		tools: [],
		settings: undefined,
		agents: undefined,
		corpusFiles: ["output-styles/brief.md"],
		checks: [{ kind: "word-band", max: 1 }],
	};
}

function corpus(sha256: string): readonly ResolvedCorpusFile[] {
	return [
		{ path: "output-styles/brief.md", resolvedPath: "/style.md", sha256 },
	];
}

const ORIGINAL = "a".repeat(64);
const EDITED = "b".repeat(64);

describe(sessionLineage.name, () => {
	it("changes when a declared corpus file's bytes change", async () => {
		const [before, after] = await Promise.all([
			sessionLineage(sessionCase(), corpus(ORIGINAL), settings),
			sessionLineage(sessionCase(), corpus(EDITED), settings),
		]);

		expect(after).not.toBe(before);
	});

	it("is unchanged when a file beside a declared one changes", async () => {
		const fixture = await mkdtemp(join(tmpdir(), "rehearsal-lineage-"));
		await writeFile(join(fixture, "declared.md"), "declared\n");

		const before = await sessionLineage(
			sessionCase(fixture),
			corpus(ORIGINAL),
			settings,
		);
		await writeFile(join(fixture, "..", "beside.md"), "beside\n");
		const after = await sessionLineage(
			sessionCase(fixture),
			corpus(ORIGINAL),
			settings,
		);

		expect(after).toBe(before);
	});

	it("changes when the fixture tree's bytes change", async () => {
		const fixture = await mkdtemp(join(tmpdir(), "rehearsal-lineage-"));
		await writeFile(join(fixture, "seed.md"), "one\n");
		const before = await sessionLineage(
			sessionCase(fixture),
			corpus(ORIGINAL),
			settings,
		);

		await writeFile(join(fixture, "seed.md"), "two\n");
		const after = await sessionLineage(
			sessionCase(fixture),
			corpus(ORIGINAL),
			settings,
		);

		expect(after).not.toBe(before);
	});

	it("changes when the prompt changes", async () => {
		const other: SessionCase = {
			...sessionCase(),
			prompt: "Say something else.",
		};

		const [before, after] = await Promise.all([
			sessionLineage(sessionCase(), corpus(ORIGINAL), settings),
			sessionLineage(other, corpus(ORIGINAL), settings),
		]);

		expect(after).not.toBe(before);
	});

	it("changes when the settings overlay changes", async () => {
		const other: SessionCase = {
			...sessionCase(),
			settings: { outputStyle: "brief" },
		};

		const [before, after] = await Promise.all([
			sessionLineage(sessionCase(), corpus(ORIGINAL), settings),
			sessionLineage(other, corpus(ORIGINAL), settings),
		]);

		expect(after).not.toBe(before);
	});

	it("changes when the transcript digest changes", async () => {
		const withTranscript: SessionCase = {
			...sessionCase(),
			declaration: {
				...sessionCase().declaration,
				transcript: {
					file: "p.jsonl",
					sha256: EDITED,
					sourceSession: "s",
					cut: 3,
				},
			},
		};

		const [before, after] = await Promise.all([
			sessionLineage(sessionCase(), corpus(ORIGINAL), settings),
			sessionLineage(withTranscript, corpus(ORIGINAL), settings),
		]);

		expect(after).not.toBe(before);
	});
});
