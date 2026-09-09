import { homedir, tmpdir } from "node:os";

function escapeRegExp(literal: string): string {
	return literal.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

const ROOTS = [homedir(), tmpdir()].map((root) => escapeRegExp(root)).join("|");

// A known root runs to the closing quote when quoted, so a directory name
// containing a space or an apostrophe cannot end the match early. The two
// general alternatives that follow are the net for a root this process cannot
// read, and they stay anchored to a word boundary (start of string,
// whitespace, an opening paren, or a quote) so a relative record id or corpus
// path that merely contains a slash survives, e.g. `checkpoint:.../shape` or
// `skills/build/SKILL.md`.
const ABSOLUTE_PATH = new RegExp(
	`(?<=['"\`])(?:${ROOTS})[^'"\`\\n]*` +
		`|(?:${ROOTS})[^\\s,)'"\`]*` +
		`|(?<=['"\`])\\/[^'"\`\\n]*` +
		`|(?<=^|[\\s(])\\/[^\\s,)]*`,
	"gu",
);

/**
 * The general form of `controlRelative`, for a message a route cannot know
 * the origin of: a checkpoint's corpus root or the target repository it ran
 * against, neither of which lives under `CONTROL_DIR`, so stripping only that
 * one prefix leaves the operator's home directory or the target's path intact
 * in an error a browser reads. Every absolute-path-shaped run is replaced
 * outright rather than made relative to anything, since nothing this module
 * reads names a root safe to keep.
 *
 * A path under a root this process cannot read, containing a quote character,
 * leaves the fragment after that quote behind: the root is gone, and what
 * survives is a directory and file name with no location. Closing that would
 * need the message's producer to mark its paths rather than the redactor to
 * find them.
 */
export function redactAbsolutePaths(message: string): string {
	return message.replaceAll(ABSOLUTE_PATH, "<path>");
}
