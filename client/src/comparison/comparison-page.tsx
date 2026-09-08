import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { useState } from "react";
import { apiClient } from "#client/api-client";
import { PlannedFeatureBlock } from "#client/system/components/planned-feature-block";
import { Switcher } from "#client/system/components/switcher";
import { TableShell } from "#client/system/components/table-shell";
import "./comparison-page.css";

const PRESENTATIONS = ["Attempt pairs", "What moved"] as const;
type Presentation = (typeof PRESENTATIONS)[number];

type ComparisonResponse = InferResponseType<
	(typeof apiClient.api.comparisons)[":digest"]["$get"],
	200
>;
type ComparisonReport = ComparisonResponse["report"];
type ComparisonCase = ComparisonReport["cases"][number];
type ComparisonArm = ComparisonCase["arms"]["baseline"];

async function fetchComparison(digest: string): Promise<ComparisonResponse> {
	const response = await apiClient.api.comparisons[":digest"].$get({
		param: { digest },
	});
	if (!response.ok) {
		throw new Error(`Could not load comparison ${digest}`);
	}

	return response.json();
}

function GradeDistribution({
	arm,
}: {
	readonly arm: ComparisonArm;
}): React.JSX.Element {
	return (
		<div className="rh-comparison__arm">
			{arm.quality.map((measure) => (
				<div key={measure.name} className="rh-comparison__measure">
					<span className="rh-comparison__measure-name">{measure.name}</span>
					{Object.entries(measure.gradeDistribution).map(([grade, count]) => (
						<span key={grade} className="rh-comparison__grade-count">
							{grade}×{count}
						</span>
					))}
				</div>
			))}
		</div>
	);
}

const COLUMNS = ["Case", "Baseline", "Candidate", "Control"] as const;

function rowFor(benchmarkCase: ComparisonCase): readonly React.ReactNode[] {
	return [
		benchmarkCase.caseId,
		<GradeDistribution key="baseline" arm={benchmarkCase.arms.baseline} />,
		<GradeDistribution key="candidate" arm={benchmarkCase.arms.candidate} />,
		<GradeDistribution key="control" arm={benchmarkCase.arms.control} />,
	];
}

export function ComparisonPage({
	digest,
}: {
	readonly digest: string;
}): React.JSX.Element {
	const [presentation, setPresentation] =
		useState<Presentation>("Attempt pairs");
	const query = useQuery({
		queryKey: ["comparison", digest],
		queryFn: () => fetchComparison(digest),
	});

	return (
		<main className="rh-comparison">
			<h1>Comparison</h1>

			{query.isLoading ? <p>Loading…</p> : null}
			{query.isError ? <p role="alert">Could not load comparison.</p> : null}

			{query.isSuccess ? (
				<Switcher
					label="Comparison presentation"
					options={PRESENTATIONS}
					selected={presentation}
					onSelect={setPresentation}
				/>
			) : null}

			{query.isSuccess && presentation === "Attempt pairs" ? (
				<TableShell
					caption="ATTEMPT PAIRS"
					columns={[...COLUMNS]}
					rows={query.data.report.cases.map((benchmarkCase) =>
						rowFor(benchmarkCase),
					)}
				/>
			) : null}

			{query.isSuccess && presentation === "What moved" ? (
				<PlannedFeatureBlock heading="What moved">
					<p>
						Needs a per-measure interval and a reading verdict a paired estimate
						cannot supply yet.
					</p>
				</PlannedFeatureBlock>
			) : null}
		</main>
	);
}
