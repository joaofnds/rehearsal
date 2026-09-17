import { describe, expect, it } from "bun:test";
import { elapsedReading, spendReading } from "./run-progress";

describe(elapsedReading.name, () => {
	it.each([
		[0, "0s"],
		[9000, "9s"],
		[59_999, "59s"],
		[60_000, "1m"],
		[3_599_000, "59m"],
		[3_600_000, "1h 0m"],
		[7_830_000, "2h 10m"],
	])("reads %i milliseconds as %s", (elapsedMs, expected) => {
		expect(elapsedReading(elapsedMs)).toBe(expected);
	});
});

describe(spendReading.name, () => {
	it.each([
		[0, "$0.00"],
		[0.9, "$0.90"],
		[12.3456, "$12.35"],
	])("reads %d dollars as %s", (spentUsd, expected) => {
		expect(spendReading(spentUsd)).toBe(expected);
	});

	/**
	 * A figure exactly on the half-cent lands wherever the nearest double sits,
	 * so 1.005 reads as $1.00 rather than $1.01. Pinned rather than corrected:
	 * a half-cent does not change what an operator does about a spend, and the
	 * arbitrary-precision arithmetic that would fix it is not worth carrying.
	 */
	it("rounds a half-cent figure by the nearest double rather than away from zero", () => {
		expect(spendReading(1.005)).toBe("$1.00");
	});
});
