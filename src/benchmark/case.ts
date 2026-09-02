import { readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { CONTROL_DIR } from "./config";
import type { Immutable, StageRubric } from "./contracts";
import type { PipelineDefinition } from "./pipeline";
import { loadPipeline } from "./pipeline";
import { loadStageRubric } from "./stage-grading";

export const CASES_DIRECTORY = "cases";

export class CaseDeclarationError extends Error {
	public override name = "CaseDeclarationError";
}

const caseIdSchema = z
	.string()
	.regex(
		/^[a-z0-9][a-z0-9-]*$/u,
		"must be lowercase letters, digits, or dashes",
	);

const caseRelativePathSchema = z.string().min(1);

export const caseDeclarationSchema = z.discriminatedUnion("kind", [
	z
		.object({
			id: caseIdSchema,
			kind: z.literal("pipeline"),
			title: z.string().min(1),
			task: caseRelativePathSchema,
			productBrief: caseRelativePathSchema,
			finalRubric: caseRelativePathSchema,
			pipeline: caseRelativePathSchema,
			rubrics: caseRelativePathSchema,
			target: z.object({ path: z.string().min(1) }).strict(),
		})
		.strict(),
]);

export type CaseDeclaration = Immutable<z.infer<typeof caseDeclarationSchema>>;

export interface LoadedStageRubric {
	readonly rubricPath: string;
	readonly content: string;
	readonly rubric: StageRubric;
}

export interface BenchmarkCase {
	readonly declaration: CaseDeclaration;
	readonly task: string;
	readonly productBrief: string;
	readonly finalRubric: string;
	readonly finalRubricPath: string;
	readonly rubricsDirectory: string;
	readonly pipelinePath: string;
	readonly pipeline: PipelineDefinition;
	readonly stageRubrics: Readonly<Record<string, LoadedStageRubric>>;
	readonly targetPath: string;
}

function caseDirectory(id: string): string {
	return join(CONTROL_DIR, CASES_DIRECTORY, id);
}

export function caseRelative(
	declaration: CaseDeclaration,
	path: string,
): string {
	const directory = caseDirectory(declaration.id);
	const absolute = resolve(directory, path);
	if (!absolute.startsWith(`${directory}/`)) {
		throw new CaseDeclarationError(
			`Case ${declaration.id} names a path outside its case directory: ${path}`,
		);
	}

	return absolute;
}

export function parseCaseDeclaration(
	id: string,
	text: string,
): CaseDeclaration {
	let document: unknown;
	try {
		document = JSON.parse(text);
	} catch (error) {
		throw new CaseDeclarationError(
			`Case ${id} declaration is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const parsed = caseDeclarationSchema.safeParse(document);
	if (!parsed.success) {
		const [issue] = parsed.error.issues;
		const field = issue?.path.join(".");

		throw new CaseDeclarationError(
			`Case ${id} declaration has an invalid ${field === undefined || field === "" ? "declaration" : field}: ${issue?.message ?? "invalid declaration"}`,
		);
	}
	if (parsed.data.id !== id) {
		throw new CaseDeclarationError(
			`Case declaration id ${parsed.data.id} does not match its directory name ${id}`,
		);
	}

	return parsed.data;
}

export async function readCaseDeclaration(
	id: string,
): Promise<CaseDeclaration> {
	if (!caseIdSchema.safeParse(id).success) {
		throw new CaseDeclarationError(
			`Unknown case ${id}: a case id is lowercase letters, digits, or dashes`,
		);
	}

	const file = Bun.file(join(caseDirectory(id), "case.json"));
	if (!(await file.exists())) {
		throw new CaseDeclarationError(
			`Unknown case ${id}: no declaration at ${relative(CONTROL_DIR, join(caseDirectory(id), "case.json"))}`,
		);
	}

	return parseCaseDeclaration(id, await file.text());
}

export interface UnreadableCase {
	readonly id: string;
	readonly reason: string;
}

export interface CaseListing {
	readonly declarations: readonly CaseDeclaration[];
	readonly unreadable: readonly UnreadableCase[];
}

async function readCaseDirectoryNames(): Promise<readonly string[]> {
	const directory = join(CONTROL_DIR, CASES_DIRECTORY);
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		throw new CaseDeclarationError(
			`No case directory at ${relative(CONTROL_DIR, directory)}`,
		);
	}

	return entries
		.filter((entry) => entry.isDirectory())
		.map(({ name }) => name)
		.toSorted((left, right) => left.localeCompare(right));
}

/**
 * A directory that holds no readable declaration is reported rather than
 * thrown, because a half-written case must not hide the cases that do read.
 */
export async function listCases(): Promise<CaseListing> {
	const declarations: CaseDeclaration[] = [];
	const unreadable: UnreadableCase[] = [];
	for (const id of await readCaseDirectoryNames()) {
		try {
			declarations.push(await readCaseDeclaration(id));
		} catch (error) {
			if (!(error instanceof CaseDeclarationError)) {
				throw error;
			}

			unreadable.push({ id, reason: error.message });
		}
	}

	return { declarations, unreadable };
}

async function loadPipelineWithRubrics(
	declaration: CaseDeclaration,
	pipelinePath: string,
): Promise<{
	readonly pipeline: PipelineDefinition;
	readonly stageRubrics: Readonly<Record<string, LoadedStageRubric>>;
}> {
	const pipeline = await loadPipeline(
		pipelinePath,
		relative(CONTROL_DIR, caseRelative(declaration, declaration.rubrics)),
	);
	const stageRubrics: Record<string, LoadedStageRubric> = {};
	for (const stage of pipeline.stages) {
		stageRubrics[stage.name] = await loadStageRubric(stage);
	}

	return { pipeline, stageRubrics };
}

/**
 * The target is the one declared path that may name a repository outside the
 * case directory, so it is resolved against that directory rather than confined
 * to it by `caseRelative`. The base is the case directory all the same: one
 * base for every path in a declaration.
 */
function declaredTarget(declaration: CaseDeclaration): string {
	const { path } = declaration.target;
	if (isAbsolute(path)) {
		return path;
	}

	return resolve(caseDirectory(declaration.id), path);
}

export async function loadCase(id: string): Promise<BenchmarkCase> {
	const declaration = await readCaseDeclaration(id);
	const pipelinePath = relative(
		CONTROL_DIR,
		caseRelative(declaration, declaration.pipeline),
	);
	const [{ pipeline, stageRubrics }, task, productBrief, finalRubric] =
		await Promise.all([
			loadPipelineWithRubrics(declaration, pipelinePath),
			Bun.file(caseRelative(declaration, declaration.task)).text(),
			Bun.file(caseRelative(declaration, declaration.productBrief)).text(),
			Bun.file(caseRelative(declaration, declaration.finalRubric)).text(),
		]);

	return {
		declaration,
		task,
		productBrief,
		finalRubric,
		finalRubricPath: caseRelative(declaration, declaration.finalRubric),
		rubricsDirectory: caseRelative(declaration, declaration.rubrics),
		pipelinePath,
		pipeline,
		stageRubrics,
		targetPath: declaredTarget(declaration),
	};
}

/**
 * `--pipeline` replaces the pipeline the case declares, and with it the stage
 * rubrics its stages name, so the override produces a whole case rather than a
 * pipeline the rest of the case no longer matches.
 */
export async function withPipeline(
	benchmarkCase: BenchmarkCase,
	pipelinePath: string,
): Promise<BenchmarkCase> {
	const { pipeline, stageRubrics } = await loadPipelineWithRubrics(
		benchmarkCase.declaration,
		pipelinePath,
	);

	return { ...benchmarkCase, pipelinePath, pipeline, stageRubrics };
}
