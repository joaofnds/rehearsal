import type { Stats } from "node:fs";
import { lstat, stat } from "node:fs/promises";

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

/**
 * The same rule as `statIfExists`, for a walk that must see a symlink rather
 * than what it points at. A directory readable but not searchable is the case
 * that separates the two failures: `readdir` lists its children and `lstat`
 * refuses them, so reading that refusal as absence would drop a real file from
 * a lineage that then reports itself complete.
 */
export async function lstatIfPresent(path: string): Promise<Stats | undefined> {
	try {
		return await lstat(path);
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

/**
 * Bytes reached through a link that leaves the tree the caller named are
 * refused, whether the walk saw the link or a containment check resolved it.
 * One planted link produces one error type across every surface, so a caller
 * translating it into a refused precondition catches one name.
 */
export class SymlinkedEntryError extends Error {
	public override name = "SymlinkedEntryError";
}
