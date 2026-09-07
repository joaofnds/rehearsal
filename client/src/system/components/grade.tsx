import "./grade.css";

export const GRADE_SIZES = [
	"12",
	"13",
	"19",
	"20",
	"22",
	"24",
	"26",
	"30",
] as const;

export type GradeSize = (typeof GRADE_SIZES)[number];

export function Grade({
	value,
	size,
}: {
	readonly value: string;
	readonly size: GradeSize;
}): React.JSX.Element {
	const isPending = value === "pending";

	return (
		<span
			className={`rh-grade rh-grade--${size} ${isPending ? "rh-grade--pending" : ""}`}
		>
			{isPending ? "—" : value}
		</span>
	);
}
