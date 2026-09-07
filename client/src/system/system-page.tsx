import { CorpusPill } from "./components/corpus-pill";
import { FilterPill } from "./components/filter-pill";
import { GRADE_SIZES, Grade } from "./components/grade";
import { SectionLabel } from "./components/section-label";
import { STATUS_STATES, Status } from "./components/status";
import { TableShell } from "./components/table-shell";
import {
	COLOR_TOKENS,
	FONT_SIZE_TOKENS,
	RADIUS_TOKENS,
	SPACE_TOKENS,
} from "./token-names";
import "./system-page.css";

const DEFERRED_COMPONENTS = [
	{ name: "Evidence disclosure", neededBy: "ACT-51 (live monitor)" },
	{ name: "Step node card", neededBy: "ACT-51 (live monitor)" },
	{ name: "Stat card", neededBy: "run detail (unfiled)" },
	{ name: "Planned-feature block", neededBy: "ACT-50 (corpus screen)" },
	{
		name: "Dialog shell",
		neededBy: "ACT-51 (step modal, its node action stack)",
	},
] as const;

function noop(): void {
	return undefined;
}

export function SystemPage(): React.JSX.Element {
	return (
		<main className="rh-system-page">
			<h1>Rehearsal design system</h1>

			<section>
				<SectionLabel>COLOR</SectionLabel>
				<ul className="rh-system-page__swatches">
					{COLOR_TOKENS.map((token) => (
						<li key={token} className="rh-system-page__swatch">
							<span
								className="rh-system-page__swatch-color"
								style={{ background: `var(${token})` }}
							/>
							<code>{token}</code>
						</li>
					))}
				</ul>
			</section>

			<section>
				<SectionLabel>TYPE SCALE</SectionLabel>
				<ul className="rh-system-page__type-scale">
					{FONT_SIZE_TOKENS.map((token) => (
						<li key={token} style={{ fontSize: `var(${token})` }}>
							{token} — the quick brown fox
						</li>
					))}
				</ul>
			</section>

			<section>
				<SectionLabel>SPACE</SectionLabel>
				<ul className="rh-system-page__space-scale">
					{SPACE_TOKENS.map((token) => (
						<li key={token}>
							<span
								className="rh-system-page__space-block"
								style={{ width: `var(${token})`, height: `var(${token})` }}
							/>
							<code>{token}</code>
						</li>
					))}
				</ul>
			</section>

			<section>
				<SectionLabel>RADIUS</SectionLabel>
				<ul className="rh-system-page__radius-scale">
					{RADIUS_TOKENS.map((token) => (
						<li key={token}>
							<span
								className="rh-system-page__radius-block"
								style={{ borderRadius: `var(${token})` }}
							/>
							<code>{token}</code>
						</li>
					))}
				</ul>
			</section>

			<section>
				<SectionLabel>STATUS</SectionLabel>
				<ul className="rh-system-page__status-list">
					{STATUS_STATES.map((state) => (
						<li key={state}>
							<Status state={state} />
						</li>
					))}
				</ul>
			</section>

			<section>
				<SectionLabel>GRADE</SectionLabel>
				<ul className="rh-system-page__grade-list">
					{GRADE_SIZES.map((size) => (
						<li key={size}>
							<Grade value="A−" size={size} />
							<code>{size}px</code>
						</li>
					))}
					<li>
						<Grade value="pending" size="19" />
						<code>pending</code>
					</li>
				</ul>
			</section>

			<section>
				<SectionLabel>CORPUS PILL</SectionLabel>
				<CorpusPill hash="a41c7e" />
			</section>

			<section>
				<SectionLabel>FILTER PILL</SectionLabel>
				<FilterPill pressed={false} onPress={noop}>
					All 148
				</FilterPill>
				<FilterPill pressed={true} onPress={noop}>
					Running
				</FilterPill>
			</section>

			<section>
				<SectionLabel>TABLE SHELL</SectionLabel>
				<TableShell
					caption="DURABLE RECORDS"
					columns={["Run", "Case"]}
					rows={[["r-0148", "auth-refactor"]]}
				/>
			</section>

			<section>
				<SectionLabel>NOT YET BUILT</SectionLabel>
				<ul>
					{DEFERRED_COMPONENTS.map((component) => (
						<li key={component.name}>
							{component.name} — needed first by {component.neededBy}
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
