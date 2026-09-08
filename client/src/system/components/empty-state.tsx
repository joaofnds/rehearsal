import type { ReactNode } from "react";
import "./empty-state.css";

export function EmptyState({
	heading,
	children,
}: {
	readonly heading: string;
	readonly children: ReactNode;
}): React.JSX.Element {
	return (
		<div className="rh-empty-state">
			<h2>{heading}</h2>
			{children}
		</div>
	);
}
