import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";

/**
 * Only a missing path may read as absent; any other failure (EACCES, EIO) must
 * surface. Reading a permission failure as absence would let a checkpoint
 * record partial state as truth and would refuse an unreadable corpus source
 * for a reason that is not the one it failed for.
 */
export async function statIfExists(path: string): Promise<Stats | undefined> {
	try {
		return await stat(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return undefined;
		}

		throw error;
	}
}

export async function pathExists(path: string): Promise<boolean> {
	return (await statIfExists(path)) !== undefined;
}
