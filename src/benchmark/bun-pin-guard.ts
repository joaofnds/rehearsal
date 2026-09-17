import { assertPinnedBunVersion } from "./bun-pin";

try {
	assertPinnedBunVersion(Bun.env.REHEARSE_REQUIRED_BUN_VERSION);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
