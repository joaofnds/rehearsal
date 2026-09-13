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
} from "./stage-settings";
import type { LoadedStageSettings } from "./stage-settings";

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
