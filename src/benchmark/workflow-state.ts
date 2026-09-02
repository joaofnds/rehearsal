import { cp, rm, stat } from "node:fs/promises";
import { join } from "node:path";

export type WorkflowPath = "backlog" | ".boris";

const WORKFLOW_PATHS: readonly WorkflowPath[] = ["backlog", ".boris"];

export interface WorkflowTree {
	readonly path: WorkflowPath;
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
): Promise<readonly WorkflowPath[]> {
	const trees = await existingWorkflowTrees(from);
	await copyWorkflowTrees(trees, to);

	return trees.map((tree) => tree.path);
}

async function copyWorkflowTrees(
	trees: readonly WorkflowTree[],
	to: string,
): Promise<void> {
	for (const tree of trees) {
		await cp(tree.directory, join(to, tree.path), { recursive: true });
	}
}

export async function replaceWorkflowState(
	from: string,
	to: string,
	paths: readonly WorkflowPath[],
): Promise<void> {
	for (const path of WORKFLOW_PATHS) {
		await rm(join(to, path), { force: true, recursive: true });
	}

	await copyWorkflowTrees(
		paths.map((path) => ({ path, directory: join(from, path) })),
		to,
	);
}
