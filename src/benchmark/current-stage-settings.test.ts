import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { CaseDeclarationError } from "./case";
import type { CaseDeclaration } from "./case";
import { CONTROL_DIR } from "./config";
import {
	currentStageSettingsReference,
	loadCurrentStageSettings,
} from "./current-stage-settings";
import type { LoadedStageSettings } from "./stage-settings";

const pipelineCase: CaseDeclaration = {
	id: "audit-log",
	kind: "pipeline",
	title: "Audit log",
	task: "task.md",
	productBrief: "brief.md",
	finalRubric: "rubric.md",
	pipeline: "pipeline.json",
	rubrics: "rubrics",
	target: { path: "/target" },
	settingsFile: "settings/stage.json",
};

describe(currentStageSettingsReference.name, () => {
	it("selects the pipeline case's declared settings file", async () => {
		const reference = await currentStageSettingsReference("audit-log", {
			readCaseDeclaration: () => Promise.resolve(pipelineCase),
		});

		expect(reference).toEqual({
			sourcePath: join(
				CONTROL_DIR,
				"cases",
				"audit-log",
				"settings/stage.json",
			),
			recordPath: "cases/audit-log/settings/stage.json",
		});
	});

	it("falls back to the root default when the case no longer loads", async () => {
		const reference = await currentStageSettingsReference("removed", {
			readCaseDeclaration: () =>
				Promise.reject(new CaseDeclarationError("case declaration unavailable")),
		});

		expect(reference).toEqual({
			sourcePath: join(CONTROL_DIR, "stage-settings.json"),
			recordPath: "stage-settings.json",
		});
	});
});

describe(loadCurrentStageSettings.name, () => {
	it("loads the selected file once", async () => {
		const loaded: LoadedStageSettings = {
			json: "{}",
			hashed: { path: "stage-settings.json", sha256: "a".repeat(64) },
		};
		const paths: string[] = [];

		const result = await loadCurrentStageSettings("audit-log", {
			readCaseDeclaration: () => Promise.resolve(pipelineCase),
			loadStageSettings: (path) => {
				paths.push(path);

				return Promise.resolve(loaded);
			},
		});

		expect(result).toBe(loaded);
		expect(paths).toEqual([
			join(CONTROL_DIR, "cases", "audit-log", "settings/stage.json"),
		]);
	});
});
