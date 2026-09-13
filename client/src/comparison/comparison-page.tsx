import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { useState } from "react";
import { apiClient } from "#client/api-client";
import { EmptyState } from "#client/system/components/empty-state";
import { Switcher } from "#client/system/components/switcher";
import { TableShell } from "#client/system/components/table-shell";
import { armPairLabel, armPairNames } from "#server/comparison-arm-pair";
import type { ComparisonAttribution } from "#server/comparison-attribution";
import type {
	QualityInterval,
	QualityReading,
} from "#server/comparison-quality-reading";
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
const QUALITY_COLUMNS = [
	"Comparison",
	"Measure",
	"Intervals",
	"Reading",
] as const;

function rowFor(benchmarkCase: ComparisonCase): readonly React.ReactNode[] {
	return [
		benchmarkCase.caseId,
		<GradeDistribution key="baseline" arm={benchmarkCase.arms.baseline} />,
		<GradeDistribution key="candidate" arm={benchmarkCase.arms.candidate} />,
		<GradeDistribution key="control" arm={benchmarkCase.arms.control} />,
	];
}

function intervalLabel(
	armName: string,
	interval: QualityInterval | undefined,
): string {
	if (interval === undefined) {
		return `${armName} not reached`;
	}

	return `${armName} ${interval.low} to ${interval.high}`;
}

function strongerRangeLabel(arm: string): string {
	const sentenceCaseArm = arm.replace(/^./u, (letter) => letter.toUpperCase());

	return `${sentenceCaseArm} has the stronger separated range`;
}

function verdictLabel(reading: QualityReading): string {
	if (reading.verdict.kind === "insideRerunNoise") {
		return "Inside rerun noise";
	}

	if (reading.verdict.kind === "unchangedAlreadyClear") {
		return "Unchanged, already clear";
	}

	return strongerRangeLabel(reading.verdict.arm);
}

function QualityIntervals({
	pairKey,
	reading,
}: {
	readonly pairKey: string;
	readonly reading: QualityReading;
}): React.JSX.Element {
	const names = armPairNames(pairKey);

	return (
		<div className="rh-comparison__quality-intervals">
			<span>{intervalLabel(names.minuend, reading.interval.minuend)}</span>
			<span>
				{intervalLabel(names.subtrahend, reading.interval.subtrahend)}
			</span>
		</div>
	);
}

function qualityRowsFor(
	readings: Readonly<Record<string, Readonly<Record<string, QualityReading>>>>,
): readonly (readonly React.ReactNode[])[] {
	return Object.entries(readings).flatMap(([pairKey, measures]) =>
		Object.entries(measures).map(([measureName, reading]) => [
			armPairLabel(pairKey),
			measureName,
			<QualityIntervals
				key={`${pairKey}-${measureName}`}
				pairKey={pairKey}
				reading={reading}
			/>,
			verdictLabel(reading),
		]),
	);
}

function QualityReadingTables({
	readings,
}: {
	readonly readings: Readonly<
		Record<
			string,
			Readonly<Record<string, Readonly<Record<string, QualityReading>>>>
		>
	>;
}): React.JSX.Element {
	return (
		<div className="rh-comparison__quality-tables">
			{Object.entries(readings).map(([caseId, caseReadings]) => (
				<TableShell
					key={caseId}
					caption={`WHAT MOVED · ${caseId}`}
					columns={QUALITY_COLUMNS}
					rows={qualityRowsFor(caseReadings)}
				/>
			))}
		</div>
	);
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
			<AttributionReading attribution={attribution} />
		</div>
	);
}

function AttributionReading({
	attribution,
}: {
	readonly attribution: ComparisonAttribution;
}): React.JSX.Element {
	if (attribution.claim === "identical") {
		return <p>No corpus difference between these arms.</p>;
	}

	if (attribution.claim === "attributable") {
		return (
			<p>
				The only corpus difference between these arms is{" "}
				<code className="rh-comparison__attribution-path">
					{attribution.differingPath}
				</code>
				. A movement between them is attributable to that file.
			</p>
		);
	}

	return (
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
	);
}

function AttributionCards({
	caseId,
	attribution,
}: {
	readonly caseId: string;
	readonly attribution: Readonly<Record<string, ComparisonAttribution>>;
}): React.JSX.Element {
	const headingId = `comparison-attribution-${caseId}`;

	return (
		<section
			className="rh-comparison__attribution-group"
			aria-labelledby={headingId}
		>
			<h2 id={headingId} className="rh-comparison__attribution-heading">
				Attribution · {caseId}
			</h2>
			<div className="rh-comparison__attribution-list">
				{Object.entries(attribution).map(([pairKey, claim]) => (
					<AttributionCard
						key={pairKey}
						pairKey={pairKey}
						attribution={claim}
					/>
				))}
			</div>
		</section>
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
							caseId={benchmarkCase.caseId}
							attribution={query.data.attribution[benchmarkCase.caseId] ?? {}}
						/>
					))}
				</>
			) : null}

			{query.isSuccess && presentation === "What moved" ? (
				<QualityReadingTables readings={query.data.qualityReadings} />
			) : null}
		</main>
	);
}
