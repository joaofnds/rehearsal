import type { ReactNode } from "react";
import "./section-label.css";

export function SectionLabel({
	children,
}: {
	readonly children: ReactNode;
}): React.JSX.Element {
	return <span className="rh-section-label">{children}</span>;
}
