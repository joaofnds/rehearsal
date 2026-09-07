import "./grade.css";

export const GRADE_SIZES = ["13", "19", "20", "22", "24", "30"] as const;

export type GradeSize = (typeof GRADE_SIZES)[number];

export type GradeValue =
	| { readonly letter: string }
	| { readonly pending: true };

export function Grade({
	value,
	size,
}: {
	readonly value: GradeValue;
	readonly size: GradeSize;
}): React.JSX.Element {
	const isPending = "pending" in value;

	return (
		<span
			className={`rh-grade rh-grade--${size} ${isPending ? "rh-grade--pending" : ""}`}
		>
			{isPending ? "—" : value.letter}
		</span>
	);
}
