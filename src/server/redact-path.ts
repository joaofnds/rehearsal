// Anchored to a word boundary (start of string, whitespace, or an opening
// paren) so a genuine absolute path is redacted without also eating a
// relative record id or corpus path that merely contains a slash, e.g.
// `checkpoint:.../shape` or `skills/build/SKILL.md`.
const ABSOLUTE_PATH = /(?<=^|[\s(])\/[^\s,)]*/gu;

/**
 * The general form of `controlRelative`, for a message a route cannot know
 * the origin of: a checkpoint's corpus root or the target repository it ran
 * against, neither of which lives under `CONTROL_DIR`, so stripping only that
 * one prefix leaves the operator's home directory or the target's path intact
 * in an error a browser reads. Every absolute-path-shaped run is replaced
 * outright rather than made relative to anything, since nothing this module
 * reads names a root safe to keep.
 */
export function redactAbsolutePaths(message: string): string {
	return message.replaceAll(ABSOLUTE_PATH, "<path>");
}
