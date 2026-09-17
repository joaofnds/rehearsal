import { REQUIRED_BUN_VERSION } from "./config";

export function assertPinnedBunVersion(
	requiredVersion: string = REQUIRED_BUN_VERSION,
	runningVersion: string = Bun.version,
): void {
	if (runningVersion !== requiredVersion) {
		throw new Error(
			`Use Bun ${requiredVersion}; current version is ${runningVersion}`,
		);
	}
}
