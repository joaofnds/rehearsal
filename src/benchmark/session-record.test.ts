import { describe, expect, it } from "bun:test";
import type { Immutable } from "#benchmark/contracts";
import type { SessionAttemptRecord } from "#benchmark/session-record";
import { sessionAttemptRecordSchema } from "#benchmark/session-record";

function record(
	overrides: Immutable<Partial<SessionAttemptRecord>> = {},
): Immutable<SessionAttemptRecord> {
	return {
		schemaVersion: 1,
		caseId: "smoke",
		lineage: "a".repeat(64),
		model: "haiku",
		sessionBudgetUsd: 0.2,
		corpusFiles: [],
		prompt: "Reply with the single word OK.",
		reply: "OK",
		transcriptFile: "/runs/transcript.jsonl",
		outcome: "SUCCESSFUL",
		checks: [{ kind: "word-band", status: "PASS", detail: "1 word" }],
		elapsedMs: 900,
		...overrides,
	};
}

/**
 * An omitted optional key and one set to undefined are different shapes under
 * exact optional property types, and the schema tells them apart, so the tests
 * for a missing reply must actually delete the key.
 */
function withoutReply(
	overrides: Immutable<Partial<SessionAttemptRecord>> = {},
): Omit<Immutable<SessionAttemptRecord>, "reply"> {
	const { reply: _dropped, ...rest } = record(overrides);

	return rest;
}

describe("sessionAttemptRecordSchema", () => {
	it("accepts a checked attempt whose outcome matches its results", () => {
		expect(sessionAttemptRecordSchema.parse(record())).toMatchObject({
			outcome: "SUCCESSFUL",
		});
	});

	it("accepts an attempt that produced no reply, with no reply and no check", () => {
		expect(
			sessionAttemptRecordSchema.parse(
				withoutReply({ outcome: "NO_REPLY", checks: [] }),
			),
		).toMatchObject({ outcome: "NO_REPLY" });
	});

	it("refuses an attempt with no reply that still records a check result", () => {
		const parsed = sessionAttemptRecordSchema.safeParse(
			withoutReply({ outcome: "NO_REPLY" }),
		);

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe(
			"A session attempt with no reply evaluates no check",
		);
	});

	it("refuses an attempt with no reply that still records one", () => {
		const parsed = sessionAttemptRecordSchema.safeParse(
			record({ outcome: "NO_REPLY", checks: [] }),
		);

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe(
			"A session attempt with no reply records no reply",
		);
	});

	it("refuses a checked attempt that records no reply", () => {
		const parsed = sessionAttemptRecordSchema.safeParse(withoutReply());

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe(
			"A session attempt that was checked records the reply it checked",
		);
	});

	it("refuses a checked attempt that evaluated no check", () => {
		const parsed = sessionAttemptRecordSchema.safeParse(record({ checks: [] }));

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe(
			"A checked session attempt records one result per declared check",
		);
	});

	/**
	 * A record on disk is data, so the kind arrives as an unchecked string; the
	 * compiler refuses this literal in typed code, which is the same guarantee
	 * one layer earlier.
	 */
	it("carries a directory origin's source", () => {
		expect(
			sessionAttemptRecordSchema.parse(
				record({ corpusOrigin: { kind: "directory", source: "/corpus" } }),
			).corpusOrigin,
		).toEqual({ kind: "directory", source: "/corpus" });
	});

	/**
	 * Records written before the origin existed carry no such field, and they
	 * were all the live install, which is what an absent origin means.
	 */
	it("accepts a record written before the origin existed", () => {
		const { corpusOrigin: _dropped, ...legacy } = record();

		expect(
			sessionAttemptRecordSchema.parse(legacy).corpusOrigin,
		).toBeUndefined();
	});

	/**
	 * The manifest is observed name-only (ACT-59, doc-9 gap 2): the transcript
	 * never carries the corpus's own bytes, so a manifest entry is a layout path
	 * and nothing a hash could attach to.
	 */
	it("carries the observed context manifest's paths", () => {
		expect(
			sessionAttemptRecordSchema.parse(
				record({
					contextManifest: { paths: ["skills/verify/SKILL.md"] },
					divergences: [],
				}),
			).contextManifest,
		).toEqual({ paths: ["skills/verify/SKILL.md"] });
	});

	it("carries a named divergence between the manifest and the declaration", () => {
		expect(
			sessionAttemptRecordSchema.parse(
				record({
					contextManifest: { paths: [] },
					divergences: [
						{ kind: "unloaded-file", path: "skills/verify/SKILL.md" },
					],
				}),
			).divergences,
		).toEqual([{ kind: "unloaded-file", path: "skills/verify/SKILL.md" }]);
	});

	/**
	 * Records written before the manifest existed carry neither field, and no
	 * observation was made of what they loaded, which is different from having
	 * observed zero divergence.
	 */
	it("accepts a record written before the context manifest existed", () => {
		const parsed = sessionAttemptRecordSchema.parse(record());

		expect(parsed.contextManifest).toBeUndefined();
		expect(parsed.divergences).toBeUndefined();
	});

	it("refuses a divergence naming a kind that does not exist", () => {
		const parsed = sessionAttemptRecordSchema.safeParse({
			...record({ contextManifest: { paths: [] } }),
			divergences: [{ kind: "renamed-file", path: "skills/verify/SKILL.md" }],
		});

		expect(parsed.success).toBe(false);
	});

	/**
	 * An origin is the live install or a directory, and nothing else. A record on
	 * disk is data, so the kind arrives as an unchecked string; the compiler
	 * refuses this shape in typed code, which is the same guarantee one layer
	 * earlier.
	 */
	it("refuses an origin naming a kind that does not exist", () => {
		const parsed = sessionAttemptRecordSchema.safeParse({
			...record(),
			corpusOrigin: { kind: "rendered", ref: "HEAD", commit: "0".repeat(40) },
		});

		expect(parsed.success).toBe(false);
	});

	it("refuses a result naming a check kind that does not exist", () => {
		const parsed = sessionAttemptRecordSchema.safeParse({
			...record({ checks: [] }),
			checks: [{ kind: "typo-band", status: "PASS", detail: "1 word" }],
		});

		expect(parsed.success).toBe(false);
	});

	it.each(["word-band", "forbidden-text", "tool-calls", "files-read"])(
		"accepts a result of the %s kind",
		(kind) => {
			expect(
				sessionAttemptRecordSchema.safeParse(
					record({ checks: [{ kind, status: "PASS", detail: "ok" }] }),
				).success,
			).toBe(true);
		},
	);

	it("refuses a successful attempt whose check failed", () => {
		const parsed = sessionAttemptRecordSchema.safeParse(
			record({
				checks: [{ kind: "word-band", status: "FAIL", detail: "9 words" }],
			}),
		);

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe(
			"A session attempt is successful when and only when every check passes",
		);
	});
});
