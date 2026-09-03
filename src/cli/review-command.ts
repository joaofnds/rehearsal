import { displayPath } from "#benchmark/config";
import type { HumanReview } from "#benchmark/contracts";
import { humanFindingSchema, humanReviewSchema } from "#benchmark/contracts";
import { benchmarkRunPaths } from "#benchmark/run-layout";
import { asUsageError, asUsageErrorAsync, UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import { writeRecord } from "#cli/output";
import { parseRunRecordId } from "#cli/record-id";

export interface ReviewRequest {
	readonly id: string | undefined;
	readonly runsDirectory: string;
	readonly json: boolean;
	readonly file: string | undefined;
	readonly verdict: string | undefined;
	readonly summary: string | undefined;
	readonly findings: readonly string[];
}

const DESCRIBING_FLAGS = ["--verdict", "--summary", "--finding"] as const;

/**
 * Two ways to say the same thing, and taking both would leave the command
 * choosing which one the caller meant. A review given as a file is the file's
 * own bytes; a review given as flags is assembled from them.
 */
function reviewText(request: Readonly<ReviewRequest>): Promise<string> {
	const described =
		request.verdict !== undefined ||
		request.summary !== undefined ||
		request.findings.length > 0;

	if (request.file !== undefined) {
		if (described) {
			throw new UsageError(
				`rehearsal review takes --file or ${DESCRIBING_FLAGS.join(", ")}, not both`,
			);
		}

		return asUsageErrorAsync(() => Bun.file(request.file ?? "").text());
	}
	if (!described) {
		throw new UsageError(
			`rehearsal review needs --file or ${DESCRIBING_FLAGS.join(", ")}`,
		);
	}

	return Promise.resolve(
		JSON.stringify({
			verdict: request.verdict,
			summary: request.summary,
			findings: request.findings.map((finding) =>
				asUsageError(() => humanFindingSchema.parse(JSON.parse(finding))),
			),
		}),
	);
}

function parseReview(text: string): HumanReview {
	return asUsageError(() => humanReviewSchema.parse(JSON.parse(text)));
}

/**
 * The review is written only after the run it belongs to is known to exist and
 * the review itself parses, so a mistyped run name or a malformed review never
 * overwrites the review a reviewer already recorded.
 */
export async function runReview(
	request: Readonly<ReviewRequest>,
	output: CommandOutput,
): Promise<void> {
	if (request.id === undefined) {
		throw new UsageError("Provide the run: rehearsal review <run:name|name>");
	}

	const { run } = parseRunRecordId(request.id);
	const paths = benchmarkRunPaths(request.runsDirectory, run);
	if (!(await Bun.file(paths.artifactFile).exists())) {
		throw new RefusedPreconditionError(
			`No run ${run} at ${displayPath(paths.artifactFile)}`,
		);
	}

	const review = parseReview(await reviewText(request));
	await Bun.write(paths.reviewFile, `${JSON.stringify(review, null, 2)}\n`);

	await writeRecord(output, paths.reviewFile, request.json);
}
