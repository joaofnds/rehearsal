import { describe, expect, it } from "bun:test";
import type { ProductOwner } from "./workflow";
import { createProductOwner, runWorkflowStage } from "./workflow";

describe("workflow provider metrics", () => {
	it("retains Product Owner calls when later metrics are absent", async () => {
		const responses = [
			JSON.stringify({
				session_id: "po-session",
				total_cost_usd: 0.2,
				num_turns: 2,
				usage: {
					input_tokens: 50,
					output_tokens: 10,
					cache_read_input_tokens: 5,
					cache_creation_input_tokens: 6,
				},
				structured_output: { answer: "Use the small scope" },
			}),
			JSON.stringify({
				session_id: "po-session",
				total_cost_usd: 0.2,
				structured_output: { answer: "Keep the same scope" },
			}),
		];
		const productOwner = createProductOwner(
			{
				directory: "/target",
				model: "sonnet",
				sessionBudgetUsd: 5,
				task: "Build it",
				productBrief: "Keep it small",
			},
			() => Promise.resolve(responses.shift() ?? ""),
		);

		await productOwner.ask("shape", "Which scope?");
		await productOwner.ask("shape", "Any constraints?");

		expect(productOwner.snapshot()).toEqual({
			sessionId: "po-session",
			spentUsd: 0.4,
			providerCalls: [
				{
					metrics: {
						costUsd: 0.2,
						inputTokens: 50,
						outputTokens: 10,
						cacheReadTokens: 5,
						cacheWriteTokens: 6,
						turns: 2,
					},
				},
				{},
			],
		});
	});

	it("retains every worker call and provider turn", async () => {
		const responses = [
			JSON.stringify({
				session_id: "worker-session",
				total_cost_usd: 0.3,
				num_turns: 2,
				usage: {
					input_tokens: 60,
					output_tokens: 12,
					cache_read_input_tokens: 7,
					cache_creation_input_tokens: 8,
				},
				structured_output: { status: "QUESTION", message: "Which scope?" },
			}),
			JSON.stringify({
				session_id: "worker-session",
				total_cost_usd: 0.4,
				num_turns: 3,
				usage: {
					input_tokens: 70,
					output_tokens: 14,
					cache_read_input_tokens: 9,
					cache_creation_input_tokens: 10,
				},
				structured_output: { status: "COMPLETE", message: "Shaped" },
			}),
		];
		const productOwner: ProductOwner = {
			ask: () => Promise.resolve("Use the small scope"),
			snapshot: () => ({
				sessionId: "po-session",
				spentUsd: 0,
				providerCalls: [],
			}),
		};

		const transcript = await runWorkflowStage(
			{
				targetDir: "/target",
				model: "sonnet",
				effort: undefined,
				sessionBudgetUsd: 5,
				productOwner,
				taskId: "ACT-5",
				stage: "shape",
				skill: "shape",
			},
			() => Promise.resolve(responses.shift() ?? ""),
		);

		expect(transcript.callMetrics).toEqual([
			{
				costUsd: 0.3,
				inputTokens: 60,
				outputTokens: 12,
				cacheReadTokens: 7,
				cacheWriteTokens: 8,
				turns: 2,
			},
			{
				costUsd: 0.4,
				inputTokens: 70,
				outputTokens: 14,
				cacheReadTokens: 9,
				cacheWriteTokens: 10,
				turns: 3,
			},
		]);
	});
});
