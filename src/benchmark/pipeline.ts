import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import { CONTROL_DIR } from "./config";

/**
 * Stage and skill names are interpolated into paths and into the prompt of a
 * session that runs without permission prompts, so both must be a single plain
 * identifier: no separators, no traversal, no whitespace, no newlines.
 */
const identifierSchema = z
	.string()
	.min(1)
	.regex(
		/^[a-z0-9][a-z0-9_-]*$/i,
		"must be letters, digits, dashes, or underscores",
	);

const stageDefinitionSchema = z.discriminatedUnion("kind", [
	z.object({
		name: identifierSchema,
		kind: z.literal("planning"),
		skill: identifierSchema,
		artifact: z.string().min(1),
		rubric: z.string().min(1),
		requiresAcceptanceCriteria: z.boolean().default(false),
	}).strict(),
	z.object({
		name: identifierSchema,
		kind: z.literal("delivery"),
		skill: identifierSchema,
		rubric: z.string().min(1),
	}).strict(),
]);

const pipelineDefinitionSchema = z.object({
	stages: z.array(stageDefinitionSchema).min(1),
});

export type StageDefinition = z.infer<typeof stageDefinitionSchema>;
export type StageKind = StageDefinition["kind"];
export type PlanningStageDefinition = Extract<
	StageDefinition,
	{ kind: "planning" }
>;
export type PipelineDefinition = z.infer<typeof pipelineDefinitionSchema>;

export class PipelineDefinitionError extends Error {}

/**
 * Names the harness has already given to something of its own. "final" marks a
 * human-review finding against the final Judge, which grades the whole
 * candidate rather than any one stage. "review" is the human-review file's
 * suffix in the run directory, which a stage of that name would overwrite.
 */
const RESERVED_STAGE_NAMES: readonly string[] = ["final", "review"];

function stageLabel(stage: unknown, index: number) {
	const name =
		typeof stage === "object" && stage !== null && "name" in stage
			? (stage as { name?: unknown }).name
			: undefined;

	return typeof name === "string" && name.length > 0
		? name
		: `stage at index ${index}`;
}

export function parsePipeline(
	content: string,
	availableRubrics: readonly string[],
): PipelineDefinition {
	let document: unknown;
	try {
		document = JSON.parse(content);
	} catch (error) {
		throw new PipelineDefinitionError(
			`Pipeline definition is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const parsed = pipelineDefinitionSchema.safeParse(document);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const [, index, ...rest] = issue?.path ?? [];
		const message = issue?.message ?? "invalid definition";

		if (typeof index !== "number") {
			throw new PipelineDefinitionError(
				`Pipeline definition has an invalid stages list: ${message}`,
			);
		}

		const rawStages = (document as { stages?: unknown })?.stages;
		const stage = Array.isArray(rawStages) ? rawStages[index] : undefined;
		const field = rest.length > 0 ? rest.join(".") : "definition";

		throw new PipelineDefinitionError(
			`Pipeline stage ${stageLabel(stage, index)} has an invalid ${field}: ${message}`,
		);
	}

	assertUniqueNames(parsed.data.stages);
	assertRubricsExist(parsed.data.stages, availableRubrics);
	assertOneDeliveryStageLast(parsed.data.stages);

	return parsed.data;
}

function assertUniqueNames(stages: readonly StageDefinition[]) {
	const seen = new Set<string>();

	for (const stage of stages) {
		if (RESERVED_STAGE_NAMES.includes(stage.name)) {
			throw new PipelineDefinitionError(
				`Pipeline stage ${stage.name} has a reserved name; ${RESERVED_STAGE_NAMES.join(", ")} cannot name a stage`,
			);
		}
		if (seen.has(stage.name)) {
			throw new PipelineDefinitionError(
				`Pipeline stage ${stage.name} has a duplicate name; every stage name must be unique`,
			);
		}
		seen.add(stage.name);
	}
}

function assertRubricsExist(
	stages: readonly StageDefinition[],
	availableRubrics: readonly string[],
) {
	for (const stage of stages) {
		if (!availableRubrics.includes(stage.rubric)) {
			throw new PipelineDefinitionError(
				`Pipeline stage ${stage.name} names a missing rubric: ${stage.rubric}`,
			);
		}
	}
}

function assertOneDeliveryStageLast(stages: readonly StageDefinition[]) {
	const deliveryStages = stages.filter(({ kind }) => kind === "delivery");
	const delivery = deliveryStages[0];

	if (!delivery) {
		throw new PipelineDefinitionError(
			"Pipeline must declare exactly one delivery stage; it declares none",
		);
	}
	if (deliveryStages.length > 1) {
		throw new PipelineDefinitionError(
			`Pipeline must declare exactly one delivery stage; it declares ${deliveryStages.map(({ name }) => name).join(", ")}`,
		);
	}
	if (stages[stages.length - 1] !== delivery) {
		throw new PipelineDefinitionError(
			`Pipeline delivery stage ${delivery.name} must be last`,
		);
	}
}

export async function loadPipeline(
	pipelinePath: string,
): Promise<PipelineDefinition> {
	const absolutePath = join(CONTROL_DIR, pipelinePath);
	const file = Bun.file(absolutePath);

	if (!(await file.exists())) {
		throw new PipelineDefinitionError(
			`Pipeline definition not found: ${pipelinePath}`,
		);
	}

	const rubricsDirectory = join(CONTROL_DIR, "rubrics");
	const availableRubrics = (await readdir(rubricsDirectory)).map((entry) =>
		relative(CONTROL_DIR, join(rubricsDirectory, entry)),
	);

	return parsePipeline(await file.text(), availableRubrics);
}
