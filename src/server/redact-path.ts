import { homedir, tmpdir } from "node:os";

function escapeRegExp(literal: string): string {
	return literal.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/**
 * A root shorter than a directory under the filesystem root is dropped rather
 * than anchored on. `homedir()` is `/` for root in many container images and
 * `tmpdir()` follows `TMPDIR`, and either as `/` or as the empty string turns
 * the unanchored alternative below into a match on every slash, which would
 * replace the relative record ids and corpus paths the general alternatives
 * exist to preserve.
 */
function usableRoots(roots: readonly string[]): readonly string[] {
	return roots.filter((root) => root.startsWith("/") && root.length > 1);
}

/**
 * A known root runs to the closing quote when quoted, so a directory name
 * containing a space cannot end the match early. An apostrophe inside the
 * name still does, which is the limit `redactAbsolutePaths` documents. The
 * general alternatives that follow are the net for a root this process cannot
 * read, and they stay anchored to a word boundary (start of string,
 * whitespace, an opening paren, or a quote) so a relative record id or corpus
 * path that merely contains a slash survives, e.g. `checkpoint:.../shape` or
 * `skills/build/SKILL.md`.
 */
function absolutePathPattern(roots: readonly string[]): RegExp {
	const known = usableRoots(roots)
		.map((root) => escapeRegExp(root))
		.join("|");
	const general = `(?<=['"\`])\\/[^'"\`\\n]*|(?<=^|[\\s(])\\/[^\\s,)]*`;

	if (known === "") {
		return new RegExp(general, "gu");
	}

	return new RegExp(
		`(?<=['"\`])(?:${known})[^'"\`\\n]*` +
			`|(?:${known})[^\\s,)'"\`]*` +
			`|${general}`,
		"gu",
	);
}

/**
 * `redactAbsolutePaths` against roots the caller names, for a test that cannot
 * change what the process reports as its home or temp directory.
 */
export function redactorFor(
	roots: readonly string[],
): (message: string) => string {
	const pattern = absolutePathPattern(roots);

	return (message) => message.replaceAll(pattern, "<path>");
}

const redact = redactorFor([homedir(), tmpdir()]);

/**
 * The general form of `controlRelative`, for a message a route cannot know
 * the origin of: a checkpoint's corpus root or the target repository it ran
 * against, neither of which lives under `CONTROL_DIR`, so stripping only that
 * one prefix leaves the operator's home directory or the target's path intact
 * in an error a browser reads. Every absolute-path-shaped run is replaced
 * outright rather than made relative to anything, since nothing this module
 * reads names a root safe to keep.
 *
 * A path containing a quote character leaves the fragment after that quote
 * behind, under a known root and an unknown one alike: the root is gone, and
 * what survives is a directory and file name with no location. Closing that
 * would need the message's producer to mark its paths rather than the redactor
 * to find them.
 */
export function redactAbsolutePaths(message: string): string {
	return redact(message);
}
