import { describe, expect, it } from "bun:test";
import type { JsonValue } from "#benchmark/json-value";
import {
	MAX_EVENT_DETAIL_BYTES,
	sessionHistoryDetail,
	sessionHistoryReport,
} from "#benchmark/session-history";

function row(record: JsonValue): string {
	return JSON.stringify(record);
}

function call(
	id: string,
	name: string,
	input: Readonly<Record<string, JsonValue>>,
): JsonValue {
	return {
		type: "assistant",
		timestamp: `2026-09-14T00:00:0${id.at(-1) ?? "0"}.000Z`,
		cwd: "/work",
		message: {
			content: [{ type: "tool_use", id, name, input }],
		},
	};
}

function result(
	id: string,
	content: string,
	options: {
		readonly error?: boolean;
		readonly snapshot?: string;
	} = {},
): JsonValue {
	const base = {
		type: "user",
		cwd: "/work",
		message: {
			content: [
				{
					type: "tool_result",
					tool_use_id: id,
					content,
					is_error: options.error ?? false,
				},
			],
		},
	} satisfies JsonValue;
	if (options.snapshot === undefined) {
		return base;
	}

	return {
		...base,
		toolUseResult: {
			type: "text",
			file: {
				filePath: "/work/CLAUDE.md",
				content: options.snapshot,
				numLines: 1,
				startLine: 1,
				totalLines: 1,
			},
		},
	};
}

describe(sessionHistoryReport.name, () => {
	it("separates inherited and repeated Read deliveries in source order", () => {
		const transcript = [
			row(call("read-0", "Read", { file_path: "/work/CLAUDE.md" })),
			row(result("read-0", "1\tinherited")),
			row(call("read-1", "Read", { file_path: "/work/CLAUDE.md" })),
			row(result("read-1", "1\talpha", { snapshot: "alpha" })),
			row(call("read-2", "Read", { file_path: "/work/CLAUDE.md" })),
			row(result("read-2", "1\talpha", { snapshot: "alpha" })),
		].join("\n");

		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript,
			prefixLinesExcluded: 2,
		});

		expect(report.evidence).toEqual({ state: "complete" });
		expect(report.startingContext.map(({ id }) => id)).toEqual(["1:1", "2:1"]);
		expect(
			report.attemptEvents.map(({ id, state }) => ({ id, state })),
		).toEqual([
			{ id: "3:1", state: "invoked" },
			{ id: "4:1", state: "delivered" },
			{ id: "5:1", state: "invoked" },
			{ id: "6:1", state: "delivered" },
		]);
		expect(report.sources).toEqual([
			expect.objectContaining({
				kind: "project",
				name: "CLAUDE.md",
				measurement: { state: "complete", characters: 14 },
				observedDeliveryCount: 2,
				repeatDeliveryCount: 1,
				failedOccurrences: 0,
				partialOccurrences: 0,
				unavailableOccurrences: 0,
			}),
		]);
	});

	it("keeps no-cut rows inspectable without inventing activity totals", () => {
		const transcript = [
			row(call("read-1", "Read", { file_path: "/work/notes.md" })),
			row(result("read-1", "notes")),
		].join("\n");

		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript,
			prefixLinesExcluded: undefined,
		});

		expect(report.evidence).toEqual({
			state: "partial",
			reasons: ["attempt boundary unavailable"],
		});
		expect(report.startingContext).toEqual([]);
		expect(report.attemptEvents).toEqual([]);
		expect(report.boundaryUnknown.map(({ id }) => id)).toEqual(["1:1", "2:1"]);
		expect(report.sources).toEqual([
			expect.objectContaining({
				region: "boundary-unknown",
				measurement: { state: "complete", characters: 5 },
				observedDeliveryCount: undefined,
				repeatDeliveryCount: undefined,
			}),
		]);
	});

	it("keeps a post-cut result separate from its inherited call", () => {
		const transcript = [
			row(call("read-1", "Read", { file_path: "/work/notes.md" })),
			row(result("read-1", "entered after the cut")),
		].join("\n");

		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript,
			prefixLinesExcluded: 1,
		});

		expect(report.attemptEvents).toEqual([
			expect.objectContaining({
				id: "2:1",
				state: "partial",
				measurement: { state: "complete", characters: 21 },
				relatedEventIds: ["1:1"],
			}),
		]);
		expect(report.sources).toEqual([
			expect.objectContaining({
				kind: "unclassified",
				measurement: { state: "complete", characters: 21 },
				observedDeliveryCount: 0,
			}),
		]);
	});

	it("distinguishes failed and missing Reads from absent and delivered Skills", () => {
		const transcript = [
			row(call("read-failed", "Read", { file_path: "/work/failure.md" })),
			row(result("read-failed", "permission denied", { error: true })),
			row(call("read-missing", "Read", { file_path: "/work/missing.md" })),
			row(call("skill-missing", "Skill", { skill: "verify" })),
			row(call("skill-done", "Skill", { skill: "build" })),
			row(result("skill-done", "loading build")),
			row({
				type: "user",
				sourceToolUseID: "skill-done",
				message: { content: "build instructions" },
			}),
		].join("\n");

		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript,
			prefixLinesExcluded: 0,
		});

		expect(
			report.attemptEvents.map(({ id, state }) => ({ id, state })),
		).toEqual([
			{ id: "1:1", state: "invoked" },
			{ id: "2:1", state: "failed" },
			{ id: "3:1", state: "unavailable" },
			{ id: "4:1", state: "unavailable" },
			{ id: "5:1", state: "invoked" },
			{ id: "6:1", state: "recorded" },
			{ id: "7:1", state: "delivered" },
		]);
		expect(report.sources.map(({ kind, name }) => ({ kind, name }))).toEqual([
			{ kind: "project", name: "failure.md" },
			{ kind: "project", name: "missing.md" },
			{ kind: "skill", name: "skills/verify/SKILL.md" },
			{ kind: "skill", name: "skills/build/SKILL.md" },
			{ kind: "tool-output", name: "Skill result · 5:1" },
		]);
	});
});

describe(sessionHistoryDetail.name, () => {
	it("shares one Unicode-safe byte budget between delivery and snapshot", () => {
		const half = MAX_EVENT_DETAIL_BYTES / 2;
		const delivered = `${"a".repeat(half - 1)}€tail`;
		const snapshot = `${"b".repeat(half - 1)}€tail`;
		const transcript = [
			row(call("read-1", "Read", { file_path: "/work/CLAUDE.md" })),
			row(result("read-1", delivered, { snapshot })),
		].join("\n");
		const input = {
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript,
			prefixLinesExcluded: 0,
		} as const;

		const detail = sessionHistoryDetail(input, "2:1");
		if (detail === undefined) {
			throw new Error("Expected selected Read detail");
		}

		expect(detail.applicationTruncated).toBe(true);
		expect(detail.deliveredText).toBe("a".repeat(half - 1));
		expect(detail.sourceSnapshot).toBe("b".repeat(half - 1));
		expect(
			Buffer.byteLength(detail.deliveredText ?? "", "utf8") +
				Buffer.byteLength(detail.sourceSnapshot ?? "", "utf8"),
		).toBeLessThanOrEqual(MAX_EVENT_DETAIL_BYTES);
		expect(delivered.startsWith(detail.deliveredText ?? "missing")).toBe(true);
		expect(snapshot.startsWith(detail.sourceSnapshot ?? "missing")).toBe(true);
	});
});
