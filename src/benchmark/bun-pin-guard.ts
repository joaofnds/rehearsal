import { REQUIRED_BUN_VERSION } from "./config";
import { pinnedBunRefusal } from "./bun-pin";

const [required = REQUIRED_BUN_VERSION] = Bun.argv.slice(2);
const refusal = pinnedBunRefusal({ required, running: Bun.version });

if (refusal !== null) {
	console.error(refusal);
	process.exit(1);
}
