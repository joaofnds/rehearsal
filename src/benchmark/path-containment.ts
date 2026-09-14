import { relative, sep } from "node:path";

export function pathIsWithin(candidate: string, root: string): boolean {
	const fromRoot = relative(root, candidate);

	return (
		fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== "..")
	);
}
