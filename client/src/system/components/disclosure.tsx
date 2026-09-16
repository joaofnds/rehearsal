import type { ReactNode } from "react";
import { useState } from "react";
import "./disclosure.css";

export function Disclosure({
	collapsedLabel,
	expandedLabel,
	children,
}: {
	readonly collapsedLabel: string;
	readonly expandedLabel: string;
	readonly children: ReactNode;
}): React.JSX.Element {
	const [expanded, setExpanded] = useState(false);

	return (
		<span className="rh-disclosure">
			<button
				type="button"
				className="rh-disclosure__toggle rh-hoverable"
				aria-expanded={expanded}
				onClick={() => {
					setExpanded(!expanded);
				}}
			>
				{expanded ? expandedLabel : collapsedLabel}
			</button>
			{expanded ? children : null}
		</span>
	);
}
