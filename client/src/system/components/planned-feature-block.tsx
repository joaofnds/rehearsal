import type { ReactNode } from "react";
import "./planned-feature-block.css";

export function PlannedFeatureBlock({
	heading,
	children,
}: {
	readonly heading: string;
	readonly children: ReactNode;
}): React.JSX.Element {
	return (
		<section className="rh-planned-feature-block">
			<header className="rh-planned-feature-block__header">
				<h2>{heading}</h2>
				<span className="rh-planned-feature-block__pill">PLANNED</span>
			</header>
			<p className="rh-planned-feature-block__note">
				Not available in v0.6 — edit on disk for now
			</p>
			{children}
		</section>
	);
}
