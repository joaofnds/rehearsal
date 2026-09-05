import { readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { CONTROL_DIR } from "./config";
import type { JsonObject } from "./json-value";
import { jsonObjectSchema } from "./json-value";
import { benchmarkRunsDirectory } from "./run-layout";
import type { Immutable, StageRubric } from "./contracts";
import type { PipelineDefinition } from "./pipeline";
import { loadPipeline } from "./pipeline";
import type { Check } from "./session-check";
import { checkSchema } from "./session-check";
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

/**
 * A case id names a directory under `cases/`, so every route into a case —
 * the declaration parser, `case show`, and a `case:` record id — asks this one
 * question rather than each deciding for itself what a case id is.
 */
export function isCaseId(text: string): boolean {
	return caseIdSchema.safeParse(text).success;
}

const caseRelativePathSchema = z.string().min(1);

export const transcriptPrefixSchema = z
	.object({
		file: z.string().min(1),
		sha256: z.string().regex(/^[0-9a-f]{64}$/u, "Invalid SHA-256 digest"),
		sourceSession: z.string().min(1),
		cut: z.number().int().positive(),
	})
	.strict();

export type TranscriptPrefix = z.infer<typeof transcriptPrefixSchema>;

const declaredModelSchema = z.string().min(1).optional();
const declaredSessionBudgetUsdSchema = z.number().positive().optional();

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
			model: declaredModelSchema,
			sessionBudgetUsd: declaredSessionBudgetUsdSchema,
		})
		.strict(),
	z
		.object({
			id: caseIdSchema,
			kind: z.literal("session"),
			title: z.string().min(1),
			fixture: caseRelativePathSchema.optional(),
			prompt: z.string().min(1),
			transcript: transcriptPrefixSchema.optional(),
			tools: z.array(z.string().min(1)),
			settings: jsonObjectSchema.optional(),
			agents: jsonObjectSchema.optional(),
			corpusFiles: z.array(z.string().min(1)),
			checks: z.array(checkSchema).min(1),
			model: declaredModelSchema,
			sessionBudgetUsd: declaredSessionBudgetUsdSchema,
		})
		.strict(),
]);

export type CaseDeclaration = Immutable<z.infer<typeof caseDeclarationSchema>>;

export type SessionCaseDeclaration = Extract<
	CaseDeclaration,
	{ readonly kind: "session" }
>;

export type PipelineCaseDeclaration = Extract<
	CaseDeclaration,
	{ readonly kind: "pipeline" }
>;

export interface LoadedStageRubric {
	readonly rubricPath: string;
	readonly content: string;
	readonly rubric: StageRubric;
}

export interface BenchmarkCase {
	readonly kind: "pipeline";
	readonly declaration: PipelineCaseDeclaration;
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

/**
 * Cases live in the control repository, and the tests that write a case must
 * not write into the one the suite is running from: a probe left behind by a
 * failure would then be listed by every later `case list`. The root is a
 * parameter so a test can own a directory of its own.
 */
export function casesRoot(): string {
	return join(CONTROL_DIR, CASES_DIRECTORY);
}

function caseDirectory(id: string, root: string = casesRoot()): string {
	return join(root, id);
}

/**
 * A declaration is untrusted data, so a path it names is confined to the one
 * directory that path's kind may reach before anything opens it. `resolve`
 * folds away `..` and absolute paths alike, so the containment is decided on
 * the resolved path rather than on the text the declaration carried.
 */
function confinedTo(directory: string, path: string, refusal: string): string {
	const absolute = resolve(directory, path);
	if (!absolute.startsWith(`${directory}/`)) {
		throw new CaseDeclarationError(refusal);
	}

	return absolute;
}

export function caseRelative(
	declaration: CaseDeclaration,
	path: string,
): string {
	return confinedTo(
		caseDirectory(declaration.id),
		path,
		`Case ${declaration.id} names a path outside its case directory: ${path}`,
	);
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

export function caseDeclarationPath(
	id: string,
	root: string = casesRoot(),
): string {
	return join(caseDirectory(id, root), "case.json");
}

export async function readCaseDeclaration(
	id: string,
	root: string = casesRoot(),
): Promise<CaseDeclaration> {
	if (!isCaseId(id)) {
		throw new CaseDeclarationError(
			`Unknown case ${id}: a case id is lowercase letters, digits, or dashes`,
		);
	}

	const path = caseDeclarationPath(id, root);
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new CaseDeclarationError(
			`Unknown case ${id}: no declaration at ${relative(CONTROL_DIR, path)}`,
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

export interface SessionCase {
	readonly kind: "session";
	readonly declaration: SessionCaseDeclaration;
	readonly fixturePath: string | undefined;
	readonly transcriptPath: string | undefined;
	readonly prompt: string;
	readonly tools: readonly string[];
	readonly settings: Immutable<JsonObject> | undefined;
	readonly agents: Immutable<JsonObject> | undefined;
	readonly corpusFiles: readonly string[];
	readonly checks: Immutable<readonly Check[]>;
}

export type LoadedCase = BenchmarkCase | SessionCase;

export function requirePipelineCase(loaded: LoadedCase): BenchmarkCase {
	if (loaded.kind !== "pipeline") {
		throw new CaseDeclarationError(
			`Case ${loaded.declaration.id} is a session case; this command takes a pipeline case`,
		);
	}

	return loaded;
}

export function requireSessionCase(loaded: LoadedCase): SessionCase {
	if (loaded.kind !== "session") {
		throw new CaseDeclarationError(
			`Case ${loaded.declaration.id} is a pipeline case; this command takes a session case`,
		);
	}

	return loaded;
}

async function loadPipelineWithRubrics(
	declaration: PipelineCaseDeclaration,
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
function declaredTarget(declaration: PipelineCaseDeclaration): string {
	const { path } = declaration.target;
	if (isAbsolute(path)) {
		return path;
	}

	return resolve(caseDirectory(declaration.id), path);
}

async function loadPipelineCase(
	declaration: PipelineCaseDeclaration,
): Promise<BenchmarkCase> {
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
		kind: "pipeline",
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
 * The transcript prefix's bytes are git-ignored run state, not case input, so
 * the declaration names the file and the loader resolves it under the run
 * directory rather than inside the committed case directory.
 */
export function transcriptPrefixPath(caseId: string, file: string): string {
	return confinedTo(
		join(benchmarkRunsDirectory(CONTROL_DIR), CASES_DIRECTORY, caseId),
		file,
		`Case ${caseId} names a transcript outside its prefix directory: ${file}`,
	);
}

function loadSessionCase(declaration: SessionCaseDeclaration): SessionCase {
	const { fixture, transcript } = declaration;

	return {
		kind: "session",
		declaration,
		fixturePath:
			fixture === undefined ? undefined : caseRelative(declaration, fixture),
		transcriptPath:
			transcript === undefined
				? undefined
				: transcriptPrefixPath(declaration.id, transcript.file),
		prompt: declaration.prompt,
		tools: declaration.tools,
		settings: declaration.settings,
		agents: declaration.agents,
		corpusFiles: declaration.corpusFiles,
		checks: declaration.checks,
	};
}

export async function loadCase(id: string): Promise<LoadedCase> {
	const declaration = await readCaseDeclaration(id);
	if (declaration.kind === "session") {
		return loadSessionCase(declaration);
	}

	return loadPipelineCase(declaration);
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
