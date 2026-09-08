import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { useState } from "react";
import { apiClient } from "#client/api-client";
import { EmptyState } from "#client/system/components/empty-state";
import { PlannedFeatureBlock } from "#client/system/components/planned-feature-block";
import { Switcher } from "#client/system/components/switcher";
import { TableShell } from "#client/system/components/table-shell";
import type { ComparisonAttribution } from "#server/comparison-attribution";
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

export class ComparisonNotFoundError extends Error {
	public override name = "ComparisonNotFoundError";
}

async function fetchComparison(digest: string): Promise<ComparisonResponse> {
	const response = await apiClient.api.comparisons[":digest"].$get({
		param: { digest },
	});
	if (response.status === 404) {
		throw new ComparisonNotFoundError(`No comparison recorded for ${digest}`);
	}
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

function armPairLabel(pairKey: string): string {
	const [minuend, subtrahend] = pairKey.split("Minus");
	const lowercasedSubtrahend =
		subtrahend === undefined
			? undefined
			: `${subtrahend[0]?.toLowerCase()}${subtrahend.slice(1)}`;

	return `${minuend} vs ${lowercasedSubtrahend}`;
}

function AttributionCard({
	pairKey,
	attribution,
}: {
	readonly pairKey: string;
	readonly attribution: ComparisonAttribution;
}): React.JSX.Element {
	return (
		<div className="rh-comparison__attribution">
			<span className="rh-comparison__attribution-pair">
				{armPairLabel(pairKey)}
			</span>
			{attribution.claim === "identical" ? (
				<p>No corpus difference between these arms.</p>
			) : (
				<div>
					<p>
						Refuses the attribution claim: more than one file could explain a
						movement between these arms.
					</p>
					<ul>
						{attribution.differingPaths.map((path) => (
							<li key={path}>{path}</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

function AttributionCards({
	attribution,
}: {
	readonly attribution: Readonly<Record<string, ComparisonAttribution>>;
}): React.JSX.Element {
	return (
		<div className="rh-comparison__attribution-list">
			{Object.entries(attribution).map(([pairKey, claim]) => (
				<AttributionCard key={pairKey} pairKey={pairKey} attribution={claim} />
			))}
		</div>
	);
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
			{query.isError && query.error instanceof ComparisonNotFoundError ? (
				<EmptyState heading="No comparison recorded">
					<p>No comparison is recorded for this digest yet.</p>
				</EmptyState>
			) : null}
			{query.isError && !(query.error instanceof ComparisonNotFoundError) ? (
				<p role="alert">Could not load comparison.</p>
			) : null}

			{query.isSuccess ? (
				<Switcher
					label="Comparison presentation"
					options={PRESENTATIONS}
					selected={presentation}
					onSelect={setPresentation}
				/>
			) : null}

			{query.isSuccess && presentation === "Attempt pairs" ? (
				<>
					<TableShell
						caption="ATTEMPT PAIRS"
						columns={[...COLUMNS]}
						rows={query.data.report.cases.map((benchmarkCase) =>
							rowFor(benchmarkCase),
						)}
					/>
					{query.data.report.cases.map((benchmarkCase) => (
						<AttributionCards
							key={benchmarkCase.caseId}
							attribution={query.data.attribution[benchmarkCase.caseId] ?? {}}
						/>
					))}
				</>
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
