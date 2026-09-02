import { cp, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const WORKFLOW_PATHS = ["backlog", ".boris"] as const;

export interface WorkflowTree {
	readonly path: string;
	readonly directory: string;
}

export async function existingWorkflowTrees(
	root: string,
): Promise<readonly WorkflowTree[]> {
	const trees: WorkflowTree[] = [];

	for (const path of WORKFLOW_PATHS) {
		const directory = join(root, path);
		try {
			await stat(directory);
		} catch (error) {
			if (
				error instanceof Error &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				continue;
			}

			throw error;
		}

		trees.push({ path, directory });
	}

	return trees;
}

export async function copyWorkflowState(
	from: string,
	to: string,
): Promise<void> {
	for (const tree of await existingWorkflowTrees(from)) {
		await cp(tree.directory, join(to, tree.path), { recursive: true });
	}
}

export async function replaceWorkflowState(
	from: string,
	to: string,
): Promise<void> {
	for (const path of WORKFLOW_PATHS) {
		await rm(join(to, path), { force: true, recursive: true });
	}

	await copyWorkflowState(from, to);
}
