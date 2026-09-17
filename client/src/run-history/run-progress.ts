const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * How long a run has been going, at the coarsest unit that still moves while
 * an operator watches. A run is minutes to hours long, so seconds past the
 * first minute would be noise, but a run in its first minute would otherwise
 * sit at "0m" long enough to look stuck.
 */
export function elapsedReading(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / MS_PER_SECOND);
	if (totalSeconds < SECONDS_PER_MINUTE) {
		return `${String(totalSeconds)}s`;
	}

	const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
	if (totalMinutes < MINUTES_PER_HOUR) {
		return `${String(totalMinutes)}m`;
	}

	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	const minutes = totalMinutes % MINUTES_PER_HOUR;

	return `${String(hours)}h ${String(minutes)}m`;
}

/**
 * Cents are the unit a spend reading moves in, so they are always shown: a
 * figure that rounded to whole dollars would sit unchanged through most of a
 * stage.
 */
export function spendReading(spentUsd: number): string {
	return `$${spentUsd.toFixed(2)}`;
}
