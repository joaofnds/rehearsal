import { mkdir } from "node:fs/promises";
import { loadComparisonEvidence } from "./comparison-evidence";
import { buildComparisonReport } from "./comparison-report";
import { comparisonReportPaths } from "./run-layout";

export interface WriteComparisonReportRequest {
	readonly manifestPath: string;
	readonly runsDirectory: string;
}

export async function writeComparisonReport(
	request: Readonly<WriteComparisonReportRequest>,
): Promise<string> {
	const evidence = await loadComparisonEvidence(request.manifestPath);
	const report = buildComparisonReport(evidence);
	const paths = comparisonReportPaths(
		request.runsDirectory,
		evidence.manifest.sha256,
	);

	await mkdir(paths.directory, { recursive: true });
	await Bun.write(paths.reportFile, `${JSON.stringify(report, null, 2)}\n`);

	return paths.reportFile;
}
