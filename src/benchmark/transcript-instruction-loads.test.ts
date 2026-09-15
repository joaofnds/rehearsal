import { describe, expect, it } from "bun:test";
import { transcriptInstructionLoads } from "#benchmark/transcript-instruction-loads";

function attachmentRow(files: readonly unknown[]): string {
	return JSON.stringify({
		type: "attachment",
		timestamp: "2026-09-14T00:00:01.000Z",
		attachment: { type: "instructions", files },
	});
}

describe(transcriptInstructionLoads.name, () => {
	it("carries path and type from the instructions attachment", () => {
		const loads = transcriptInstructionLoads(
			attachmentRow([
				{
					path: "/Users/someone/.claude/CLAUDE.md",
					type: "User",
					content: "# How work is done here",
				},
				{
					path: "/tmp/project/CLAUDE.md",
					type: "Project",
					content: "# Working on it",
				},
			]),
		);

		expect(loads).toEqual({
			state: "available",
			loads: [
				{
					filePath: "/Users/someone/.claude/CLAUDE.md",
					memoryType: "User",
					loadReason: { state: "unavailable" },
					triggerFilePath: { state: "unavailable" },
					parentFilePath: { state: "unavailable" },
				},
				{
					filePath: "/tmp/project/CLAUDE.md",
					memoryType: "Project",
					loadReason: { state: "unavailable" },
					triggerFilePath: { state: "unavailable" },
					parentFilePath: { state: "unavailable" },
				},
			],
		});
	});

	it("reports loads unavailable when the transcript carries no instructions attachment", () => {
		const loads = transcriptInstructionLoads(
			JSON.stringify({
				type: "attachment",
				attachment: {
					type: "nested_memory",
					files: [{ path: "/tmp/other.md", type: "Project", content: "x" }],
				},
			}),
		);

		expect(loads).toEqual({ state: "unavailable" });
	});

	it("selects on the attachment type rather than the presence of files", () => {
		const loads = transcriptInstructionLoads(
			[
				JSON.stringify({
					type: "attachment",
					attachment: {
						type: "nested_memory",
						files: [{ path: "/tmp/nested.md", type: "Project", content: "x" }],
					},
				}),
				attachmentRow([
					{ path: "/tmp/real.md", type: "Project", content: "y" },
				]),
			].join("\n"),
		);

		expect(
			loads.state === "available" && loads.loads.map((load) => load.filePath),
		).toEqual(["/tmp/real.md"]);
	});
});
