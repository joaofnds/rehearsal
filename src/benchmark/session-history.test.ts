import { describe, expect, it } from "bun:test";
import type { JsonValue } from "#benchmark/json-value";
import {
	MAX_EVENT_DETAIL_BYTES,
	sessionHistoryDetail,
	sessionHistoryReport,
	sessionHistoryRequestSeries,
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
		readonly startLine?: number;
		readonly numLines?: number;
		readonly totalLines?: number;
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
				numLines: options.numLines ?? 1,
				startLine: options.startLine ?? 1,
				totalLines: options.totalLines ?? 1,
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
		expect(report.boundary).toBe("known");
		expect(report.startingContext.map(({ id }) => id)).toEqual(["1:1", "2:1"]);
		expect(report.startingContext.at(1)?.deliveryOrdinal).toBe(1);
		expect(report.startingContext.at(1)?.label).toBe("Read delivered · first");
		expect(
			report.attemptEvents.map(({ id, state }) => ({ id, state })),
		).toEqual([
			{ id: "3:1", state: "invoked" },
			{ id: "4:1", state: "delivered" },
			{ id: "5:1", state: "invoked" },
			{ id: "6:1", state: "delivered" },
		]);
		expect(report.attemptEvents[0]?.measurement).toEqual({
			state: "unavailable",
			reasons: ["tool invocation carries no result content"],
		});
		expect(
			report.attemptEvents
				.filter(({ state }) => state === "delivered")
				.map(({ deliveryOrdinal, label }) => ({ deliveryOrdinal, label })),
		).toEqual([
			{ deliveryOrdinal: 1, label: "Read delivered · first" },
			{ deliveryOrdinal: 2, label: "Read delivered · subsequent" },
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
				missingOccurrences: 0,
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
		expect(report.boundary).toBe("unknown");
		expect(report.startingContext).toEqual([]);
		expect(report.attemptEvents).toEqual([]);
		expect(report.boundaryUnknown.map(({ id }) => id)).toEqual(["1:1", "2:1"]);
		expect(report.boundaryUnknown.at(1)?.label).toBe("Read delivered");
		expect(report.boundaryUnknown[1]?.deliveryOrdinal).toBeUndefined();
		expect(report.sources).toEqual([
			expect.objectContaining({
				region: "boundary-unknown",
				measurement: { state: "complete", characters: 5 },
				observedDeliveryCount: undefined,
				repeatDeliveryCount: undefined,
			}),
		]);
	});

	it("keeps duplicate result IDs as separate partial evidence", () => {
		const transcript = [
			row(call("read-1", "Read", { file_path: "/work/notes.md" })),
			row(result("read-1", "first body")),
			row(result("read-1", "second body")),
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
			{ id: "2:1", state: "partial" },
			{ id: "3:1", state: "partial" },
		]);
		expect(report.evidence).toEqual({
			state: "partial",
			reasons: [
				"ambiguous tool result read-1 at 2:1",
				"ambiguous tool result read-1 at 3:1",
			],
		});
		expect(report.sources).toEqual([
			expect.objectContaining({
				observedDeliveryCount: 0,
				partialOccurrences: 2,
				missingOccurrences: 0,
				unavailableOccurrences: 0,
			}),
		]);
	});

	it("retains no-content historical rows as unsupported locator evidence", () => {
		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript: [
				row({ type: "system" }),
				row({ message: { content: [] } }),
			].join("\n"),
			prefixLinesExcluded: undefined,
		});

		expect(report.boundaryUnknown).toEqual([
			expect.objectContaining({ id: "1:1", state: "recorded" }),
			expect.objectContaining({ id: "2:1", state: "recorded" }),
		]);
		expect(report.evidence).toEqual({
			state: "partial",
			reasons: [
				"unsupported content at 1:1",
				"unsupported content at 2:1",
				"attempt boundary unavailable",
			],
		});
		expect(report.sources).toEqual([
			expect.objectContaining({
				measurement: {
					state: "partial",
					observedCharacters: 0,
					reasons: ["unsupported text body"],
				},
			}),
		]);
	});

	it("makes unsupported result content partial at report level", () => {
		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [],
			},
			transcript: [
				row(call("bash-1", "Bash", { command: "pwd" })),
				row({
					message: {
						content: [
							{
								type: "tool_result",
								tool_use_id: "bash-1",
								content: { unsupported: true },
							},
						],
					},
				}),
			].join("\n"),
			prefixLinesExcluded: 0,
		});

		expect(report.attemptEvents.at(1)?.state).toBe("unavailable");
		expect(report.evidence).toEqual({
			state: "partial",
			reasons: ["unsupported text body at 2:1"],
		});
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

	it("matches a relative Read against its exact recorded corpus path", () => {
		const report = sessionHistoryReport({
			attempt: {
				caseId: "case-a",
				id: "attempt-a",
				model: "sonnet",
				outcome: "SUCCESSFUL",
				corpusFiles: [{ path: "shared.md", resolvedPath: "/work/shared.md" }],
			},
			transcript: [
				row(call("read-1", "Read", { file_path: "shared.md" })),
				row(result("read-1", "corpus body")),
			].join("\n"),
			prefixLinesExcluded: 0,
		});

		expect(report.sources).toEqual([
			expect.objectContaining({
				kind: "corpus",
				name: "shared.md",
				path: "shared.md",
			}),
		]);
	});

	it("classifies saved corpus, project, external, tool, and escaping sources", () => {
		const transcript = [
			row(call("corpus", "Read", { file_path: "/work/.claude/rules.md" })),
			row(result("corpus", "corpus")),
			row(call("project", "Read", { file_path: "/work/project.md" })),
			row(result("project", "project")),
			row(call("external", "Read", { file_path: "/outside.md" })),
			row(result("external", "external")),
			row(call("escape", "Read", { file_path: "../escape.md" })),
			row(result("escape", "escape")),
			row(call("bash", "Bash", { command: "pwd" })),
			row(result("bash", "output")),
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

		expect(report.sources.map(({ kind }) => kind)).toEqual([
			"corpus",
			"project",
			"external",
			"unclassified",
			"tool-output",
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
		expect(
			report.sources
				.filter(({ name }) => name === "missing.md" || name.includes("verify"))
				.map(({ missingOccurrences, unavailableOccurrences }) => ({
					missingOccurrences,
					unavailableOccurrences,
				})),
		).toEqual([
			{ missingOccurrences: 1, unavailableOccurrences: 0 },
			{ missingOccurrences: 1, unavailableOccurrences: 0 },
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

	it("marks an incomplete structured Read line range as partial coverage", () => {
		const transcript = [
			row(call("read-1", "Read", { file_path: "/work/CLAUDE.md" })),
			row(
				result("read-1", "delivered", {
					snapshot: "middle line",
					startLine: 3,
					numLines: 1,
					totalLines: 8,
				}),
			),
		].join("\n");
		const detail = sessionHistoryDetail(
			{
				attempt: {
					caseId: "case-a",
					id: "attempt-a",
					model: "sonnet",
					outcome: "SUCCESSFUL",
					corpusFiles: [],
				},
				transcript,
				prefixLinesExcluded: 0,
			},
			"2:1",
		);

		expect(detail?.snapshotMeasurement).toEqual({
			state: "partial",
			observedCharacters: 11,
			reasons: ["source snapshot is a partial line range"],
		});
		expect(detail?.sourceSnapshotRange).toEqual({
			startLine: 3,
			deliveredLineCount: 1,
			totalLineCount: 8,
			coverage: "partial",
		});
	});
});

describe(sessionHistoryRequestSeries.name, () => {
	function assistantRow(
		second: string,
		requestId: string | null | undefined,
		model: string,
		usage: {
			readonly input: number;
			readonly output: number;
			readonly cacheRead: number;
			readonly cacheWrite: number;
		},
	): JsonValue {
		const message = {
			model,
			usage: {
				input_tokens: usage.input,
				output_tokens: usage.output,
				cache_read_input_tokens: usage.cacheRead,
				cache_creation_input_tokens: usage.cacheWrite,
			},
			content: [{ type: "text", text: "reply" }],
		} satisfies JsonValue;
		const withoutRequestId = {
			type: "assistant",
			timestamp: `2026-09-14T00:00:0${second}.000Z`,
			cwd: "/work",
			message,
		} satisfies JsonValue;
		if (requestId === undefined) {
			return withoutRequestId;
		}

		return { ...withoutRequestId, requestId };
	}

	it("marks each entry with the region its line falls in", () => {
		const usage = { input: 2, output: 10, cacheRead: 100, cacheWrite: 20 };
		const transcript = [
			row(assistantRow("1", "req-inherited", "claude-opus-5", usage)),
			row(assistantRow("2", "req-attempt", "claude-sonnet-5", usage)),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 1,
		});

		expect(
			series.entries.map(({ requestId, region }) => ({ requestId, region })),
		).toEqual([
			{ requestId: "req-inherited", region: "starting-context" },
			{ requestId: "req-attempt", region: "attempt" },
		]);
	});

	it("marks every entry boundary-unknown when the transcript carries no boundary", () => {
		const usage = { input: 2, output: 10, cacheRead: 100, cacheWrite: 20 };
		const transcript = [
			row(assistantRow("1", "req-a", "claude-opus-5", usage)),
			row(assistantRow("2", "req-b", "claude-sonnet-5", usage)),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: undefined,
		});

		expect(series.boundary).toBe("unknown");
		expect(series.entries.map(({ region }) => region)).toEqual([
			"boundary-unknown",
			"boundary-unknown",
		]);
	});

	it("totals only the requests inside the attempt region", () => {
		const transcript = [
			row(
				assistantRow("1", "req-inherited", "claude-opus-5", {
					input: 7,
					output: 90_592,
					cacheRead: 5,
					cacheWrite: 9,
				}),
			),
			row(
				assistantRow("2", "req-attempt", "claude-sonnet-5", {
					input: 2,
					output: 151,
					cacheRead: 0,
					cacheWrite: 251_695,
				}),
			),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 1,
		});

		expect(series.boundary).toBe("known");
		expect(series.attemptTotals).toEqual({
			state: "complete",
			requestCount: 1,
			usage: {
				inputTokens: 2,
				outputTokens: 151,
				cacheReadTokens: 0,
				cacheWriteTokens: 251_695,
			},
			totalInputTokens: 251_697,
		});
	});

	it("reports attempt totals unavailable rather than zero when the boundary is unknown", () => {
		const transcript = row(
			assistantRow("1", "req-a", "claude-opus-5", {
				input: 2,
				output: 151,
				cacheRead: 0,
				cacheWrite: 251_695,
			}),
		);

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: undefined,
		});

		expect(series.attemptTotals).toEqual({
			state: "unavailable",
			reasons: ["the transcript carries no attempt boundary"],
		});
	});

	it("marks attempt totals incomplete when a request in the region has no settled usage", () => {
		const transcript = [
			row(
				assistantRow("1", "req-conflict", "claude-sonnet-5", {
					input: 2,
					output: 10,
					cacheRead: 0,
					cacheWrite: 20,
				}),
			),
			row(
				assistantRow("2", "req-conflict", "claude-sonnet-5", {
					input: 3,
					output: 10,
					cacheRead: 0,
					cacheWrite: 20,
				}),
			),
			row(
				assistantRow("3", "req-settled", "claude-sonnet-5", {
					input: 2,
					output: 151,
					cacheRead: 0,
					cacheWrite: 251_695,
				}),
			),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 0,
		});

		expect(series.attemptTotals).toEqual({
			state: "incomplete",
			requestCount: 2,
			countedRequestCount: 1,
			usage: {
				inputTokens: 2,
				outputTokens: 151,
				cacheReadTokens: 0,
				cacheWriteTokens: 251_695,
			},
			totalInputTokens: 251_697,
			reasons: ["1 of 2 attempt-region requests carry no settled usage"],
		});
	});

	it("yields one entry per distinct request in transcript order", () => {
		const transcript = [
			row(
				assistantRow("1", "req-b", "claude-opus-5", {
					input: 2,
					output: 10,
					cacheRead: 100,
					cacheWrite: 20,
				}),
			),
			row(
				assistantRow("2", "req-a", "claude-sonnet-5", {
					input: 3,
					output: 11,
					cacheRead: 200,
					cacheWrite: 30,
				}),
			),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 0,
		});

		expect(
			series.entries.map((entry) => ({
				requestId: entry.requestId,
				model: entry.model,
				usage: entry.usageState === "complete" ? entry.usage : undefined,
			})),
		).toEqual([
			{
				requestId: "req-b",
				model: "claude-opus-5",
				usage: {
					inputTokens: 2,
					outputTokens: 10,
					cacheReadTokens: 100,
					cacheWriteTokens: 20,
				},
			},
			{
				requestId: "req-a",
				model: "claude-sonnet-5",
				usage: {
					inputTokens: 3,
					outputTokens: 11,
					cacheReadTokens: 200,
					cacheWriteTokens: 30,
				},
			},
		]);
	});
	it("collapses duplicate rows sharing a request into one entry", () => {
		const usage = { input: 2, output: 10, cacheRead: 100, cacheWrite: 20 };
		const transcript = [
			row(assistantRow("1", "req-a", "claude-opus-5", usage)),
			row(assistantRow("2", "req-a", "claude-opus-5", usage)),
			row(assistantRow("3", "req-a", "claude-opus-5", usage)),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 0,
		});

		expect(
			series.entries.map(({ requestId, line, usageState }) => ({
				requestId,
				line,
				usageState,
			})),
		).toEqual([{ requestId: "req-a", line: 1, usageState: "complete" }]);
	});

	it.each([
		["input", { input: 5, output: 10, cacheRead: 100, cacheWrite: 20 }],
		["output", { input: 2, output: 11, cacheRead: 100, cacheWrite: 20 }],
		["cache read", { input: 2, output: 10, cacheRead: 101, cacheWrite: 20 }],
		["cache write", { input: 2, output: 10, cacheRead: 100, cacheWrite: 21 }],
	])(
		"reports conflict when duplicates disagree on %s tokens",
		(_category, second) => {
			const transcript = [
				row(
					assistantRow("1", "req-a", "claude-opus-5", {
						input: 2,
						output: 10,
						cacheRead: 100,
						cacheWrite: 20,
					}),
				),
				row(assistantRow("2", "req-a", "claude-opus-5", second)),
			].join("\n");

			const series = sessionHistoryRequestSeries({
				transcript,
				prefixLinesExcluded: 0,
			});

			expect(series.entries).toEqual([
				{
					requestId: "req-a",
					line: 1,
					region: "attempt",
					model: "claude-opus-5",
					usageState: "conflict",
				},
			]);
		},
	);

	it("withholds the model when duplicates disagree on which one ran", () => {
		const usage = { input: 2, output: 10, cacheRead: 100, cacheWrite: 20 };
		const transcript = [
			row(assistantRow("1", "req-a", "claude-opus-5", usage)),
			row(assistantRow("2", "req-a", "claude-haiku-4-5", usage)),
		].join("\n");

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 0,
		});

		expect(series.entries).toEqual([
			{
				requestId: "req-a",
				line: 1,
				region: "attempt",
				model: undefined,
				modelState: "conflict",
				usage: {
					inputTokens: 2,
					outputTokens: 10,
					cacheReadTokens: 100,
					cacheWriteTokens: 20,
				},
				totalInputTokens: 122,
				usageState: "complete",
			},
		]);
	});
	it("totals the three input categories as total input tokens", () => {
		const transcript = row(
			assistantRow("1", "req-a", "claude-opus-5", {
				input: 2,
				output: 151,
				cacheRead: 30_000,
				cacheWrite: 251_695,
			}),
		);

		const series = sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 0,
		});

		const [entry] = series.entries;

		expect(entry?.usageState).toBe("complete");
		expect(entry?.usageState === "complete" && entry.totalInputTokens).toBe(
			281_697,
		);
	});

	it.each([
		["absent from the row", undefined],
		["present and null", null],
	])(
		"values a row whose requestId is %s at zero rather than omitting it",
		(_label, requestId) => {
			const transcript = [
				row(
					assistantRow("1", requestId, "<synthetic>", {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
					}),
				),
				row(
					assistantRow("2", "req-a", "claude-sonnet-5", {
						input: 2,
						output: 151,
						cacheRead: 0,
						cacheWrite: 251_695,
					}),
				),
			].join("\n");

			const series = sessionHistoryRequestSeries({
				transcript,
				prefixLinesExcluded: 0,
			});

			expect(
				series.entries.map((entry) => ({
					requestId: entry.requestId,
					model: entry.model,
					totalInputTokens:
						entry.usageState === "complete"
							? entry.totalInputTokens
							: undefined,
				})),
			).toEqual([
				{ requestId: undefined, model: "<synthetic>", totalInputTokens: 0 },
				{
					requestId: "req-a",
					model: "claude-sonnet-5",
					totalInputTokens: 251_697,
				},
			]);
		},
	);

	it("names what the total omits without claiming the categories overlap", () => {
		const series = sessionHistoryRequestSeries({
			transcript: row(
				assistantRow("1", "req-a", "claude-opus-5", {
					input: 2,
					output: 151,
					cacheRead: 0,
					cacheWrite: 251_695,
				}),
			),
			prefixLinesExcluded: 0,
		});

		expect(series.name).toBe("total input tokens");
		expect(series.omits).toEqual([
			"the request's own output tokens",
			"the model's context window limit, which the transcript does not carry",
		]);
		expect(series.measuresActiveContextWindow).toBe(false);
	});
});
