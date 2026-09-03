import { describe, expect, it } from "bun:test";
import { UsageError } from "#cli/commands";
import { formatRecordId, parseRecordId } from "#cli/record-id";

const EVERY_FORM = [
	"case:audit-log",
	"run:2026-09-03T00-00-00.000Z",
	"checkpoint:2026-09-03T00-00-00.000Z/build",
	"attempt:session:smoke/fa239c6c-6389-4999-b2f1-90708471af9d",
	"attempt:stage:cafe1234/2026-09-03T00-00-00.000Z",
	"group:group-1",
	`comparison:${"a".repeat(64)}`,
];

describe(parseRecordId.name, () => {
	it("reads a checkpoint id as the run and the stage it names", () => {
		const id = parseRecordId("checkpoint:2026-09-03T00-00-00.000Z/build");

		expect(id).toEqual({
			kind: "checkpoint",
			run: "2026-09-03T00-00-00.000Z",
			stage: "build",
		});
	});

	it("reads a session attempt id as the case and the uuid it names", () => {
		const id = parseRecordId(
			"attempt:session:smoke/fa239c6c-6389-4999-b2f1-90708471af9d",
		);

		expect(id).toEqual({
			kind: "attempt:session",
			caseId: "smoke",
			uuid: "fa239c6c-6389-4999-b2f1-90708471af9d",
		});
	});

	it("reads a stage attempt id as the lineage and the timestamp it names", () => {
		const id = parseRecordId("attempt:stage:cafe1234/2026-09-03T00-00-00.000Z");

		expect(id).toEqual({
			kind: "attempt:stage",
			lineage: "cafe1234",
			timestamp: "2026-09-03T00-00-00.000Z",
		});
	});

	it.each(EVERY_FORM)("round-trips %s through its parsed value", (text) => {
		expect(formatRecordId(parseRecordId(text))).toBe(text);
	});

	describe("when the text names no known prefix", () => {
		it("refuses it as a usage error naming every id form", () => {
			expect(() => parseRecordId("nonsense")).toThrow(UsageError);
			expect(() => parseRecordId("nonsense")).toThrow(
				/case:<id>.*run:<name>.*checkpoint:<run>\/<stage>/u,
			);
		});
	});

	describe("when a segment would name a path outside the runs directory", () => {
		it.each([
			"run:../../../etc/passwd",
			"group:../../../../etc/passwd",
			"case:../audit-log",
			"comparison:..",
			"checkpoint:../run/build",
			"checkpoint:run/../build",
			"attempt:session:../smoke/uuid",
			"attempt:stage:lineage/..",
		])("refuses %s as a usage error", (text) => {
			expect(() => parseRecordId(text)).toThrow(UsageError);
		});

		it.each([
			"run:../../etc/passwd",
			"checkpoint:a/..",
			"attempt:session:smoke/..",
		])("reports %s as the user typed it", (text) => {
			expect(() => parseRecordId(text)).toThrow(
				`Record id ${text} names a path outside the runs directory`,
			);
		});
	});

	describe("when a case id is not a case id", () => {
		it.each(["case:Some Weird Name", "case:UPPER", "case:-leading-dash"])(
			"refuses %s the way case show refuses the same mistake",
			(text) => {
				expect(() => parseRecordId(text)).toThrow(UsageError);
				expect(() => parseRecordId(text)).toThrow(
					/lowercase letters, digits, or dashes/u,
				);
			},
		);

		it("accepts the case ids this repository declares", () => {
			expect(parseRecordId("case:audit-log")).toEqual({
				kind: "case",
				caseId: "audit-log",
			});
		});
	});

	describe("when a known prefix carries the wrong body", () => {
		it("names the form that prefix takes", () => {
			expect(() => parseRecordId("checkpoint:only-one-part")).toThrow(
				/checkpoint:<run>\/<stage>/u,
			);
		});

		it("refuses an attempt id that names no attempt kind", () => {
			expect(() => parseRecordId("attempt:cafe1234/2026-09-03")).toThrow(
				/attempt:session:<case>\/<uuid>/u,
			);
		});

		it("refuses a prefix with an empty body", () => {
			expect(() => parseRecordId("run:")).toThrow(/run:<name>/u);
		});
	});
});
