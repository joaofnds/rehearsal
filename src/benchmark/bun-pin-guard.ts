import { assertPinnedBunVersion } from "./bun-pin";

const [requiredVersion] = Bun.argv.slice(2);

try {
	assertPinnedBunVersion(requiredVersion);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
