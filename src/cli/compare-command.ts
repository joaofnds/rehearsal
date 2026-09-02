import { writeComparisonReport } from "#benchmark/comparison-command";
import { UsageError } from "#cli/commands";
import type { CommandOutput } from "#cli/output";
import { writeRecord } from "#cli/output";

export interface CompareRequest {
	readonly manifestPath: string | undefined;
	readonly runsDirectory: string;
	readonly json: boolean;
}

export async function runCompare(
	request: CompareRequest,
	output: CommandOutput,
): Promise<void> {
	const { manifestPath } = request;
	if (manifestPath === undefined) {
		throw new UsageError(
			"Provide the comparison manifest: rehearsal compare <comparison-manifest.json>",
		);
	}

	const reportFile = await writeComparisonReport({
		manifestPath,
		runsDirectory: request.runsDirectory,
	});

	await writeRecord(output, reportFile, request.json);
}
