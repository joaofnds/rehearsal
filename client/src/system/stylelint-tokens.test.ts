import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import stylelint from "stylelint";

const fixturesDir = join(import.meta.dir, "__fixtures__");

describe("stylelint raw-value rules", () => {
	it("reports a bare hex color outside the token definitions", async () => {
		const result = await stylelint.lint({
			files: join(fixturesDir, "raw-hex.css"),
			config: {
				extends: join(import.meta.dir, "../../../.stylelintrc.json"),
			},
		});

		const warnings = result.results[0]?.warnings ?? [];
		expect(warnings.some((warning) => warning.rule === "color-no-hex")).toBe(true);
	});

	it("reports a bare px padding outside the token definitions", async () => {
		const result = await stylelint.lint({
			files: join(fixturesDir, "raw-px.css"),
			config: {
				extends: join(import.meta.dir, "../../../.stylelintrc.json"),
			},
		});

		const warnings = result.results[0]?.warnings ?? [];
		expect(
			warnings.some((warning) => warning.rule === "declaration-property-unit-disallowed-list"),
		).toBe(true);
	});

	it("passes the token definitions file despite raw hex values", async () => {
		const result = await stylelint.lint({
			files: join(import.meta.dir, "tokens.css"),
			config: {
				extends: join(import.meta.dir, "../../../.stylelintrc.json"),
			},
		});

		expect(result.results[0]?.warnings ?? []).toEqual([]);
	});
});
