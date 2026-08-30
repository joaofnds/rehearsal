import { z } from "zod";

const stageDefinitionSchema = z.discriminatedUnion("kind", [
	z.object({
		name: z.string().min(1),
		kind: z.literal("planning"),
		skill: z.string().min(1),
		artifact: z.string().min(1),
		rubric: z.string().min(1),
	}),
	z.object({
		name: z.string().min(1),
		kind: z.literal("delivery"),
		skill: z.string().min(1),
		rubric: z.string().min(1),
	}),
]);

const pipelineDefinitionSchema = z.object({
	stages: z.array(stageDefinitionSchema).min(1),
});

export type StageDefinition = z.infer<typeof stageDefinitionSchema>;
export type PipelineDefinition = z.infer<typeof pipelineDefinitionSchema>;

export class PipelineDefinitionError extends Error {}

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

	const { stages } = parsed.data;
	const seen = new Set<string>();
	for (const stage of stages) {
		if (seen.has(stage.name)) {
			throw new PipelineDefinitionError(
				`Pipeline stage ${stage.name} has a duplicate name; every stage name must be unique`,
			);
		}
		seen.add(stage.name);
	}

	for (const stage of stages) {
		if (!availableRubrics.includes(stage.rubric)) {
			throw new PipelineDefinitionError(
				`Pipeline stage ${stage.name} names a missing rubric: ${stage.rubric}`,
			);
		}
	}

	const deliveryStages = stages.filter(({ kind }) => kind === "delivery");
	if (deliveryStages.length === 0) {
		throw new PipelineDefinitionError(
			"Pipeline must declare exactly one delivery stage; it declares none",
		);
	}
	if (deliveryStages.length > 1) {
		throw new PipelineDefinitionError(
			`Pipeline must declare exactly one delivery stage; it declares ${deliveryStages.map(({ name }) => name).join(", ")}`,
		);
	}

	const delivery = deliveryStages[0];
	if (delivery && stages[stages.length - 1] !== delivery) {
		throw new PipelineDefinitionError(
			`Pipeline delivery stage ${delivery.name} must be last`,
		);
	}

	return parsed.data;
}
