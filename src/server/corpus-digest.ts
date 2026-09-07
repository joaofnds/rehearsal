import { createHash } from "node:crypto";
import { canonicalFiles } from "#benchmark/checkpoint";
import type { HashedFile } from "#benchmark/checkpoint";

const DIGEST_DISPLAY_LENGTH = 6;

/**
 * `corpus@<hash>` in SPEC.md's example is 6 hex characters; the full sha256
 * this hashes against stays available to a caller that wants it in full.
 */
export function corpusDigest(files: readonly HashedFile[]): string {
	return createHash("sha256")
		.update(JSON.stringify(canonicalFiles(files)))
		.digest("hex")
		.slice(0, DIGEST_DISPLAY_LENGTH);
}
