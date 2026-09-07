import type { ReactNode } from "react";
import "./filter-pill.css";

export function FilterPill({
	pressed,
	onPress,
	children,
}: {
	readonly pressed: boolean;
	readonly onPress: () => void;
	readonly children: ReactNode;
}): React.JSX.Element {
	return (
		<button
			type="button"
			className={`rh-filter-pill rh-hoverable ${pressed ? "rh-filter-pill--pressed" : ""}`}
			aria-pressed={pressed}
			onClick={onPress}
		>
			{children}
		</button>
	);
}
