import { join } from "node:path";
import {
	CaseDeclarationError,
	declaredSettingsFilePath,
	readCaseDeclaration,
} from "./case";
import { CONTROL_DIR, displayPath } from "./config";
import {
	DEFAULT_STAGE_SETTINGS_FILE,
	loadStageSettings,
	StageSettingsError,
} from "./stage-settings";
import type { LoadedStageSettings } from "./stage-settings";
import type { HashedFile } from "./checkpoint";

export interface CurrentStageSettingsReference {
	readonly sourcePath: string;
	readonly recordPath: string;
}

interface DeclarationDependencies {
	readonly readCaseDeclaration: typeof readCaseDeclaration;
}

interface CurrentStageSettingsDependencies extends DeclarationDependencies {
	readonly loadStageSettings: typeof loadStageSettings;
}

const declarationDependencies: DeclarationDependencies = {
	readCaseDeclaration,
};

const currentSettingsDependencies: CurrentStageSettingsDependencies = {
	...declarationDependencies,
	loadStageSettings,
};

function referenceFor(sourcePath: string): CurrentStageSettingsReference {
	return { sourcePath, recordPath: displayPath(sourcePath) };
}

function defaultReference(): CurrentStageSettingsReference {
	return referenceFor(join(CONTROL_DIR, DEFAULT_STAGE_SETTINGS_FILE));
}

/**
 * The settings declaration a run's case has today. A deleted, renamed, or
 * malformed case and a case that has become a session case fall back to the
 * harness default, matching replay's existing recovery policy.
 */
export async function currentStageSettingsReference(
	caseId: string,
	dependencies: DeclarationDependencies = declarationDependencies,
): Promise<CurrentStageSettingsReference> {
	try {
		const declaration = await dependencies.readCaseDeclaration(caseId);
		if (declaration.kind === "pipeline") {
			return referenceFor(declaredSettingsFilePath(declaration));
		}
	} catch (error) {
		if (!(error instanceof CaseDeclarationError)) {
			throw error;
		}
	}

	return defaultReference();
}

export async function loadCurrentStageSettings(
	caseId: string,
	dependencies: CurrentStageSettingsDependencies = currentSettingsDependencies,
): Promise<LoadedStageSettings> {
	const reference = await currentStageSettingsReference(caseId, dependencies);

	return dependencies.loadStageSettings(reference.sourcePath);
}

export type CurrentStageSettingsComparison =
	| { readonly settingsFile: HashedFile }
	| { readonly settingsFileRefusal: string };

/**
 * Reporting cannot make one unreadable settings file hide every other run.
 * Keep replay's strict loader for paid work, but turn its known settings error
 * into a per-run comparison refusal with only the durable path identity.
 */
export async function compareCurrentStageSettings(
	caseId: string,
	dependencies: CurrentStageSettingsDependencies = currentSettingsDependencies,
): Promise<CurrentStageSettingsComparison> {
	const reference = await currentStageSettingsReference(caseId, dependencies);
	try {
		return {
			settingsFile: (await dependencies.loadStageSettings(reference.sourcePath))
				.hashed,
		};
	} catch (error) {
		if (!(error instanceof StageSettingsError)) {
			throw error;
		}

		return {
			settingsFileRefusal: `stage settings file ${reference.recordPath} is unavailable: ${error.message.replaceAll(reference.sourcePath, reference.recordPath)}`,
		};
	}
}
