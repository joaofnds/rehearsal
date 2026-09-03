import { unhandled } from "#benchmark/contracts";
import { UsageError } from "#cli/commands";

export interface CaseRecordId {
	readonly kind: "case";
	readonly caseId: string;
}

export interface RunRecordId {
	readonly kind: "run";
	readonly run: string;
}

export interface CheckpointRecordId {
	readonly kind: "checkpoint";
	readonly run: string;
	readonly stage: string;
}

export interface SessionAttemptRecordId {
	readonly kind: "attempt:session";
	readonly caseId: string;
	readonly uuid: string;
}

export interface StageAttemptRecordId {
	readonly kind: "attempt:stage";
	readonly lineage: string;
	readonly timestamp: string;
}

export interface GroupRecordId {
	readonly kind: "group";
	readonly groupId: string;
}

export interface ComparisonRecordId {
	readonly kind: "comparison";
	readonly manifestDigest: string;
}

export type RecordId =
	| CaseRecordId
	| RunRecordId
	| CheckpointRecordId
	| SessionAttemptRecordId
	| StageAttemptRecordId
	| GroupRecordId
	| ComparisonRecordId;

/**
 * Both attempt kinds name two segments, so the kind is spelled in the prefix
 * rather than sniffed from the first segment's shape: a session attempt is a
 * case and a uuid, a stage attempt a lineage and a timestamp, and only the
 * prefix tells a reader or this parser which one it has.
 */
const ID_FORMS: readonly string[] = [
	"case:<id>",
	"run:<name>",
	"checkpoint:<run>/<stage>",
	"attempt:session:<case>/<uuid>",
	"attempt:stage:<lineage>/<timestamp>",
	"group:<group-id>",
	"comparison:<manifest-digest>",
];

export function recordIdForms(): readonly string[] {
	return ID_FORMS;
}

/**
 * A segment is interpolated into a path under the runs directory, so a value
 * satisfying the id's shape can still name a destination outside it: `run:..`
 * reads a sibling of `.benchmark-runs`, and `group:../../../../etc/passwd`
 * leaves the repository entirely. Shape is not destination, and refusing the
 * segment here means no caller can hold an id that escapes. The message names
 * the id as the caller typed it, because an id they never wrote tells them
 * nothing about which one to correct.
 */
interface IdBody {
	/** The id exactly as the caller typed it, which is what a refusal names. */
	readonly given: string;
	/** The form this prefix takes, which is what a malformed body is told. */
	readonly form: string;
	/** Everything after the prefix, which is what the segments come from. */
	readonly body: string;
}

function confined(id: IdBody, text: string): string {
	if (text === "." || text === ".." || text.includes("/")) {
		throw new UsageError(
			`Record id ${id.given} names a path outside the runs directory`,
		);
	}

	return text;
}

function segment(id: IdBody): string {
	if (id.body === "") {
		throw new UsageError(`Record id ${id.given} takes the form ${id.form}`);
	}

	return confined(id, id.body);
}

function twoSegments(id: IdBody): readonly [string, string] {
	const parts = id.body.split("/");
	const [first, second] = parts;
	if (
		parts.length !== 2 ||
		first === undefined ||
		first === "" ||
		second === undefined ||
		second === ""
	) {
		throw new UsageError(`Record id ${id.given} takes the form ${id.form}`);
	}

	return [confined(id, first), confined(id, second)];
}

function parseAttemptId(id: string, body: string): RecordId {
	const separator = body.indexOf(":");
	const attemptKind = separator === -1 ? body : body.slice(0, separator);
	const rest = separator === -1 ? "" : body.slice(separator + 1);

	if (attemptKind === "session") {
		const [caseId, uuid] = twoSegments({
			given: id,
			form: "attempt:session:<case>/<uuid>",
			body: rest,
		});

		return { kind: "attempt:session", caseId, uuid };
	}
	if (attemptKind === "stage") {
		const [lineage, timestamp] = twoSegments({
			given: id,
			form: "attempt:stage:<lineage>/<timestamp>",
			body: rest,
		});

		return { kind: "attempt:stage", lineage, timestamp };
	}

	throw new UsageError(
		`Record id attempt:${body} names no attempt kind: use attempt:session:<case>/<uuid> or attempt:stage:<lineage>/<timestamp>`,
	);
}

/**
 * The one place a string becomes a record id. `show` holds the parsed value
 * and never asks which record a bare string named, and `formatRecordId` is its
 * inverse so every id a listing prints parses back to the value it came from.
 */
export function parseRecordId(text: string): RecordId {
	const separator = text.indexOf(":");
	if (separator === -1) {
		throw new UsageError(
			`Record id ${text} names no record kind: use ${ID_FORMS.join(", ")}`,
		);
	}

	const prefix = text.slice(0, separator);
	const body = text.slice(separator + 1);
	switch (prefix) {
		case "case": {
			return {
				kind: "case",
				caseId: segment({ given: text, form: "case:<id>", body }),
			};
		}
		case "run": {
			return {
				kind: "run",
				run: segment({ given: text, form: "run:<name>", body }),
			};
		}
		case "checkpoint": {
			const [run, stage] = twoSegments({
				given: text,
				form: "checkpoint:<run>/<stage>",
				body,
			});

			return { kind: "checkpoint", run, stage };
		}
		case "attempt": {
			return parseAttemptId(text, body);
		}
		case "group": {
			return {
				kind: "group",
				groupId: segment({ given: text, form: "group:<group-id>", body }),
			};
		}
		case "comparison": {
			return {
				kind: "comparison",
				manifestDigest: segment({
					given: text,
					form: "comparison:<manifest-digest>",
					body,
				}),
			};
		}
		default: {
			throw new UsageError(
				`Record id ${text} names no record kind: use ${ID_FORMS.join(", ")}`,
			);
		}
	}
}

export function formatRecordId(id: RecordId): string {
	switch (id.kind) {
		case "case": {
			return `case:${id.caseId}`;
		}
		case "run": {
			return `run:${id.run}`;
		}
		case "checkpoint": {
			return `checkpoint:${id.run}/${id.stage}`;
		}
		case "attempt:session": {
			return `attempt:session:${id.caseId}/${id.uuid}`;
		}
		case "attempt:stage": {
			return `attempt:stage:${id.lineage}/${id.timestamp}`;
		}
		case "group": {
			return `group:${id.groupId}`;
		}
		case "comparison": {
			return `comparison:${id.manifestDigest}`;
		}
		default: {
			return unhandled(id, "record id kind");
		}
	}
}
