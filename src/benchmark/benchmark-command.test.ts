import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeBenchmark } from "./benchmark-command";
import { PROJECT_ROOT } from "./test-support";

describe(executeBenchmark.name, () => {
	it("keeps debug evidence single and gates three pipeline reps on approval", async () => {
		const config = {
			sourceDir: "/target",
			model: "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/test.json",
		};
		const debugOutput: string[] = [];
		const debug = await executeBenchmark(config, 2, {
			approval: {
				output: (message) => {
					debugOutput.push(message);
				},
				prompt: () => Promise.resolve("no"),
			},
			runDebug: () => Promise.resolve({ judge: "PASS" }),
			runConfirmed: () =>
				Promise.reject(new Error("confirmation must not run")),
		});
		expect(debugOutput).toEqual(["single-rep evidence, not a score"]);
		expect(debug).toEqual({ kind: "debug", evidence: { judge: "PASS" } });

		const approval = Promise.withResolvers<string>();
		const events: string[] = [];
		const confirmations: unknown[] = [];
		const execution = executeBenchmark(
			{ ...config, confirmation: { reps: 3, approved: false } },
			2,
			{
				approval: {
					output: (message) => {
						events.push(`output:${message}`);
					},
					prompt: (message) => {
						events.push(`prompt:${message}`);

						return approval.promise;
					},
				},
				runDebug: () => Promise.reject(new Error("debug must not run")),
				runConfirmed: (request) => {
					confirmations.push(request);
					events.push(`start:${request.reps}`);

					return Promise.resolve({ group: "pipeline-1" });
				},
			},
		);
		await Promise.resolve();
		expect(confirmations).toEqual([]);
		expect(events).toEqual([
			"output:Projected maximum cost: $135.00 (3 reps x $45.00)",
			"prompt:Start confirmation? [y/N] ",
		]);
		approval.resolve("yes");
		expect(await execution).toEqual({
			kind: "confirmation",
			evidence: { group: "pipeline-1" },
		});
		expect(confirmations).toEqual([
			{
				reps: 3,
				projectedCost: {
					reps: 3,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 135,
				},
				approvalMethod: "interactive",
			},
		]);
	});

	it("routes the production CLI through approval before target access", async () => {
		const missingTarget = join(tmpdir(), `missing-target-${randomUUID()}`);
		const child = Bun.spawn(
			[
				process.execPath,
				"run-benchmark.ts",
				"--target",
				missingTarget,
				"--model",
				"sonnet",
				"--session-budget-usd",
				"1",
				"--confirm",
			],
			{
				cwd: PROJECT_ROOT,
				stdin: new Blob(["no\n"]),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const [exitCode, stdout, stderr] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);

		expect(exitCode).not.toBe(0);
		expect(stdout).toContain("Projected maximum cost: $45.00");
		expect(stderr).toContain("Confirmation declined");
		expect(stderr).not.toContain(missingTarget);
		expect(stderr).not.toContain("Self-preference warning");
	});

	it("warns once before continuing with an explicit same-family Judge", async () => {
		const child = Bun.spawn(
			[
				process.execPath,
				"run-benchmark.ts",
				"--target",
				"missing-target",
				"--model",
				"sonnet",
				"--judge-model",
				"claude-sonnet-4-6",
				"--session-budget-usd",
				"1",
				"--confirm",
			],
			{
				cwd: PROJECT_ROOT,
				stdin: new Blob(["no\n"]),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const [exitCode, stderr] = await Promise.all([
			child.exited,
			new Response(child.stderr).text(),
		]);

		expect(exitCode).not.toBe(0);
		expect(stderr.match(/Self-preference warning/gu)).toEqual([
			"Self-preference warning",
		]);
		expect(stderr.indexOf("Self-preference warning")).toBeLessThan(
			stderr.indexOf("Confirmation declined"),
		);
	});
});
