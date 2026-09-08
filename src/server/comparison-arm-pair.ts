import type { ComparisonArm } from "#benchmark/comparison-record";

export function pairKey(
	minuend: ComparisonArm,
	subtrahend: ComparisonArm,
): string {
	return `${minuend}Minus${subtrahend[0]?.toUpperCase()}${subtrahend.slice(1)}`;
}

/**
 * The one place that decodes a `pairKey` back into its two arm names. This
 * module has no value imports (only `ComparisonArm`'s type, erased at
 * compile time), so the client imports it directly instead of re-deriving
 * the `Minus` convention on its own.
 */
export function armPairLabel(pair: string): string {
	const [minuend, subtrahend] = pair.split("Minus");
	const lowercasedSubtrahend =
		subtrahend === undefined
			? undefined
			: `${subtrahend[0]?.toLowerCase()}${subtrahend.slice(1)}`;

	return `${minuend} vs ${lowercasedSubtrahend}`;
}

/**
 * The report's own three canonical contrasts (`comparison-record.ts`'s
 * `contrasts` field: `candidateMinusBaseline`, `candidateMinusControl`,
 * `baselineMinusControl`), not every ordered pair the three arms could form.
 * Every unordered pair once, since "candidate vs baseline" and "baseline vs
 * candidate" describe the same file diff and rendering both would show the
 * same claim twice under swapped labels.
 */
export function armPairs(): readonly {
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
}[] {
	return [
		{ minuend: "candidate", subtrahend: "baseline" },
		{ minuend: "candidate", subtrahend: "control" },
		{ minuend: "baseline", subtrahend: "control" },
	];
}
