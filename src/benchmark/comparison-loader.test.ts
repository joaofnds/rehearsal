import { createHash } from "node:crypto";
import {
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	rm,
	symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	confirmationGroupRecordSchema,
	confirmationRepRecordSchema,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import { writeComparisonReport } from "./comparison-command";
import { parseComparisonReport } from "./comparison-record";
import { runCommand } from "./command";
import { CONTROL_DIR } from "./config";
import { loadComparisonEvidence } from "./comparison-evidence";
import type { ComparisonArm } from "./comparison-record";
import { comparisonReportPaths } from "./run-layout";

function digest(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

async function directoryDigests(
	directory: string,
): Promise<Readonly<Record<string, string>>> {
	const digests: Record<string, string> = {};
	const entries = await readdir(directory, { recursive: true });
	for (const entry of entries.toSorted()) {
		const path = join(directory, entry);
		const file = Bun.file(path);
		if (!(await file.exists()) || file.type === "directory") {
			continue;
		}

		digests[entry] = createHash("sha256")
			.update(await file.bytes())
			.digest("hex");
	}

	return digests;
}

class ComparisonEvidenceFixture {
	public constructor(private readonly root: string) {}

	public get manifestFile(): string {
		return join(this.root, "comparison.json");
	}

	public groupFile(caseId: string, role: ComparisonArm): string {
		return join(this.groupDirectory(caseId, role), "group.json");
	}

	public repFile(caseId: string, role: ComparisonArm, ordinal: number): string {
		return join(
			this.groupDirectory(caseId, role),
			"reps",
			`${caseId}-${role}-rep-${ordinal}`,
			"rep.json",
		);
	}

	public corpusFile(caseId: string, role: ComparisonArm): string {
		return join(
			this.groupDirectory(caseId, role),
			"inputs",
			"corpus",
			"build",
			"SKILL.md",
		);
	}

	public async write(): Promise<void> {
		const cases = [];
		for (const caseId of ["case-1", "case-2"]) {
			const arms = {
				baseline: await this.writeGroup(caseId, "baseline"),
				candidate: await this.writeGroup(caseId, "candidate"),
				control: await this.writeGroup(caseId, "control"),
			};
			cases.push({ caseId, arms });
		}

		await Bun.write(
			this.manifestFile,
			`${JSON.stringify({ schemaVersion: 1, cases }, null, 2)}\n`,
		);
	}

	public async pointFrozenInputAt(
		kind: ConfirmationGroupRecord["inputs"]["files"][number]["kind"],
		path: string,
	): Promise<void> {
		const sha256 = digest(await Bun.file(path).text());
		for (const caseId of ["case-1", "case-2"]) {
			for (const role of ["baseline", "candidate", "control"] as const) {
				const groupFile = this.groupFile(caseId, role);
				const group = confirmationGroupRecordSchema.parse(
					JSON.parse(await Bun.file(groupFile).text()),
				);
				const changed = confirmationGroupRecordSchema.parse({
					...group,
					inputs: {
						...group.inputs,
						files: group.inputs.files.map((file) =>
							file.kind === kind ? { kind: file.kind, path, sha256 } : file,
						),
					},
				});
				await Bun.write(groupFile, `${JSON.stringify(changed, null, 2)}\n`);
			}
		}
	}

	public async usePipelineCheckpoints(
		changedWorkflowRole?: ComparisonArm,
	): Promise<void> {
		for (const caseId of ["case-1", "case-2"]) {
			for (const role of ["baseline", "candidate", "control"] as const) {
				const groupFile = this.groupFile(caseId, role);
				const group = confirmationGroupRecordSchema.parse(
					JSON.parse(await Bun.file(groupFile).text()),
				);
				const checkpoint = {
					stage: "initial",
					targetSha: role.slice(0, 1).repeat(40),
					lineage: `${role}-derived-lineage`,
					upstream: `${role}-derived-upstream`,
					model: "sonnet",
					corpusFiles: [],
					artifacts: [],
					workflowState:
						role === changedWorkflowRole
							? [
									{
										path: "backlog/tasks/act.md",
										sha256: "f".repeat(64),
									},
								]
							: [],
				};
				const checkpointPath = join(
					this.groupDirectory(caseId, role),
					"inputs/checkpoint/checkpoint.json",
				);
				const checkpointText = `${JSON.stringify(checkpoint, null, 2)}\n`;
				await Bun.write(checkpointPath, checkpointText);
				const upstreamCorpus = `${role} upstream corpus\n`;
				const upstreamCorpusPath = join(
					this.groupDirectory(caseId, role),
					"inputs/corpus/discuss/SKILL.md",
				);
				await Bun.write(upstreamCorpusPath, upstreamCorpus);
				const changedGroup = confirmationGroupRecordSchema.parse({
					...group,
					mode: "pipeline",
					inputs: {
						...group.inputs,
						files: [
							...group.inputs.files.map((file) =>
								file.path === "inputs/corpus/discuss/SKILL.md"
									? {
											kind: file.kind,
											path: file.path,
											sha256: digest(upstreamCorpus),
										}
									: file,
							),
							{
								kind: "checkpoint",
								path: relative(
									this.groupDirectory(caseId, role),
									checkpointPath,
								),
								sha256: digest(checkpointText),
							},
						],
					},
				});
				await Bun.write(
					groupFile,
					`${JSON.stringify(changedGroup, null, 2)}\n`,
				);

				for (const ordinal of [1, 2]) {
					const repFile = this.repFile(caseId, role, ordinal);
					const rep = parseConfirmationRepRecord(
						await Bun.file(repFile).text(),
					);
					await Bun.write(
						repFile,
						`${JSON.stringify(
							{
								...rep,
								mode: "pipeline",
								finalOutcome: {
									status: "JUDGED",
									verdict: "PASS",
									evidence: {
										resultSha: "e".repeat(40),
										recordFile: "final.json",
									},
								},
							},
							null,
							2,
						)}\n`,
					);
				}
			}
		}
	}

	private groupDirectory(caseId: string, role: ComparisonArm): string {
		return join(this.root, "groups", `${caseId}-${role}`);
	}

	private static lineage(
		caseId: string,
	): ConfirmationGroupRecord["inputs"]["lineage"] {
		return {
			kind: "CHECKPOINT",
			lineage: `${caseId}-checkpoint`,
			targetSha: (caseId === "case-1" ? "a" : "b").repeat(40),
		};
	}

	private async writeFrozenInputs(
		caseId: string,
		role: ComparisonArm,
	): Promise<ConfirmationGroupRecord["inputs"]["files"]> {
		const directory = this.groupDirectory(caseId, role);
		const files = [
			{
				kind: "checkpoint" as const,
				path: "inputs/checkpoint/state.json",
				content: `${caseId} checkpoint\n`,
			},
			{
				kind: "corpus" as const,
				path: "inputs/corpus/build/SKILL.md",
				content: `${role} corpus\n`,
			},
			{
				kind: "corpus" as const,
				path: "inputs/corpus/discuss/SKILL.md",
				content: `${caseId} upstream corpus\n`,
			},
			{
				kind: "instructions" as const,
				path: "inputs/instructions.md",
				content: `${role} corpus\n`,
			},
			{
				kind: "pipeline" as const,
				path: "inputs/pipeline.json",
				content: '{"stages":["build"]}\n',
			},
			{
				kind: "product-brief" as const,
				path: "inputs/product-brief.md",
				content: `${caseId} brief\n`,
			},
			{
				kind: "rubric" as const,
				path: "inputs/rubric.json",
				content: `${caseId} rubric\n`,
			},
			{
				kind: "task" as const,
				path: "inputs/task.md",
				content: `${caseId} task\n`,
			},
		];
		for (const file of files) {
			const path = join(directory, file.path);
			await mkdir(dirname(path), { recursive: true });
			await Bun.write(path, file.content);
		}

		return files.map(({ content, kind, path }) => ({
			kind,
			path,
			sha256: digest(content),
		}));
	}

	private static repRecord(
		caseId: string,
		role: ComparisonArm,
		ordinal: number,
	): ConfirmationRepRecord {
		const groupId = `${caseId}-${role}`;
		const repId = `${groupId}-rep-${ordinal}`;
		const resultEvidence = {
			resultSha: "e".repeat(40),
			recordFile: "stages/build.json",
		};

		return confirmationRepRecordSchema.parse({
			schemaVersion: 1,
			groupId,
			repId,
			ordinal,
			mode: "stage",
			worktreePath: `/worktrees/${repId}`,
			lineage: ComparisonEvidenceFixture.lineage(caseId),
			outcome: "SUCCESSFUL",
			stages: [
				{
					stage: "build",
					status: "JUDGED",
					grade: "A",
					verdict: "CONTINUE",
					elapsedMs: 10,
					evidence: resultEvidence,
				},
			],
			finalOutcome: { status: "NOT_APPLICABLE" },
			metrics: {
				status: "COMPLETE",
				calls: [
					{
						role: "worker",
						metrics: {
							costUsd: ordinal,
							inputTokens: ordinal * 10,
							outputTokens: ordinal * 2,
							cacheReadTokens: ordinal * 3,
							cacheWriteTokens: ordinal * 4,
							turns: ordinal,
						},
					},
				],
			},
			workerTrajectorySteps: ordinal,
			elapsedMs: ordinal * 100,
		});
	}

	private async writeGroup(
		caseId: string,
		role: ComparisonArm,
	): Promise<string> {
		const groupId = `${caseId}-${role}`;
		const groupDirectory = this.groupDirectory(caseId, role);
		const repRecords = [];
		for (const ordinal of [1, 2]) {
			const recordFile = this.repFile(caseId, role, ordinal);
			await mkdir(dirname(recordFile), { recursive: true });
			await Bun.write(
				recordFile,
				`${JSON.stringify(ComparisonEvidenceFixture.repRecord(caseId, role, ordinal), null, 2)}\n`,
			);
			repRecords.push({
				repId: `${groupId}-rep-${ordinal}`,
				ordinal,
				path: relative(groupDirectory, recordFile),
			});
		}

		const group = confirmationGroupRecordSchema.parse({
			schemaVersion: 1,
			groupId,
			mode: "stage",
			reps: 2,
			declaredStages: ["build"],
			inputs: {
				lineage: ComparisonEvidenceFixture.lineage(caseId),
				files: await this.writeFrozenInputs(caseId, role),
				model: "sonnet",
				judgeModel: "opus",
				sessionBudgetUsd: 5,
				pipelinePath: "pipelines/default.json",
			},
			projectedCost: {
				reps: 2,
				perRepMaximumUsd: 20,
				totalMaximumUsd: 40,
			},
			approval: { method: "yes", approved: true },
			repRecords,
			reportFile: "report.json",
			makespanMs: 200,
		});
		const groupFile = this.groupFile(caseId, role);
		await Bun.write(groupFile, `${JSON.stringify(group, null, 2)}\n`);

		return relative(dirname(this.manifestFile), groupFile);
	}
}

describe(loadComparisonEvidence.name, () => {
	let temporaryDirectory: string;
	let fixture: ComparisonEvidenceFixture;
	let writtenReportFile: string | undefined;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(
			join(tmpdir(), "rehearsal-comparison-loader-"),
		);
		fixture = new ComparisonEvidenceFixture(temporaryDirectory);
		await fixture.write();
	});

	afterEach(async () => {
		if (writtenReportFile !== undefined) {
			await rm(dirname(writtenReportFile), { force: true, recursive: true });
		}
		await rm(temporaryDirectory, { force: true, recursive: true });
	});

	it("loads and hashes source groups, reps, and executed corpus", async () => {
		const evidence = await loadComparisonEvidence(fixture.manifestFile);
		const candidate = evidence.cases.at(0)?.arms.candidate;

		expect(evidence.contract).toEqual({
			mode: "stage",
			declaredStages: ["build"],
			reps: 2,
		});
		expect(evidence.manifest.sha256).toMatch(/^[0-9a-f]{64}$/u);
		expect(candidate?.role).toBe("candidate");
		expect(candidate?.group.path).toBe("groups/case-1-candidate/group.json");
		expect(candidate?.group.sha256).toMatch(/^[0-9a-f]{64}$/u);
		expect(candidate?.reps.map(({ path }) => path)).toEqual([
			"groups/case-1-candidate/reps/case-1-candidate-rep-1/rep.json",
			"groups/case-1-candidate/reps/case-1-candidate-rep-2/rep.json",
		]);
		expect(candidate?.reps.at(0)?.sha256).toMatch(/^[0-9a-f]{64}$/u);
		expect(candidate?.reps.at(1)?.sha256).toMatch(/^[0-9a-f]{64}$/u);
		expect(candidate?.executedCorpus).toEqual([
			{
				kind: "corpus",
				path: "inputs/corpus/build/SKILL.md",
				sha256: digest("candidate corpus\n"),
			},
		]);
	});

	it("names a missing source group before report creation", async () => {
		await rm(fixture.groupFile("case-1", "control"));

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-1 arm control field group.path",
		);
	});

	it("names an invalid source group before report creation", async () => {
		await Bun.write(fixture.groupFile("case-2", "baseline"), "{}\n");

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-2 arm baseline field group.record",
		);
	});

	it("names a missing referenced rep record", async () => {
		await rm(fixture.repFile("case-2", "control", 1));

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-2 arm control field repRecords[0].path",
		);
	});

	it("names an invalid referenced rep record", async () => {
		await Bun.write(fixture.repFile("case-1", "candidate", 2), "{}\n");

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-1 arm candidate field repRecords[1].record",
		);
	});

	it("names a rep whose mode disagrees with its source group", async () => {
		const repFile = fixture.repFile("case-1", "baseline", 1);
		const record = parseConfirmationRepRecord(await Bun.file(repFile).text());
		const changed = {
			...record,
			mode: "pipeline" as const,
			outcome: "UNSUCCESSFUL" as const,
		};
		await Bun.write(repFile, `${JSON.stringify(changed, null, 2)}\n`);

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-1 arm baseline field repRecords[0].mode",
		);
	});

	it("rejects frozen corpus bytes that no longer match their digest", async () => {
		await Bun.write(
			fixture.corpusFile("case-2", "candidate"),
			"tampered corpus\n",
		);

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-2 arm candidate field inputs.files[corpus:inputs/corpus/build/SKILL.md].sha256",
		);
	});

	it("normalizes only pipeline checkpoint identities derived from each corpus", async () => {
		await fixture.usePipelineCheckpoints();

		const evidence = await loadComparisonEvidence(fixture.manifestFile);

		expect(evidence.contract.mode).toBe("pipeline");
	});

	it("rejects changed workflow state inside a pipeline checkpoint record", async () => {
		await fixture.usePipelineCheckpoints("candidate");

		expect(loadComparisonEvidence(fixture.manifestFile)).rejects.toThrow(
			"case case-1 arms baseline and candidate field inputs.files.checkpoint:inputs/checkpoint/checkpoint.json",
		);
	});

	it("creates no comparison layout when source validation fails", async () => {
		const runsDirectory = join(temporaryDirectory, "comparison-output");
		await rm(fixture.repFile("case-1", "baseline", 1));

		expect(
			writeComparisonReport({
				manifestPath: fixture.manifestFile,
				runsDirectory,
			}),
		).rejects.toThrow("case case-1 arm baseline field repRecords[0].path");
		expect(await Bun.file(runsDirectory).exists()).toBe(false);
	});

	it("rejects a report destination that is also frozen source evidence", async () => {
		const runsDirectory = join(temporaryDirectory, "comparison-output");
		const manifestSha = digest(await Bun.file(fixture.manifestFile).text());
		const { reportFile } = comparisonReportPaths(runsDirectory, manifestSha);
		await mkdir(dirname(reportFile), { recursive: true });
		await Bun.write(reportFile, "source task evidence\n");
		await fixture.pointFrozenInputAt("task", reportFile);

		expect(
			writeComparisonReport({
				manifestPath: fixture.manifestFile,
				runsDirectory,
			}),
		).rejects.toThrow("destination overlaps source evidence");
		expect(await Bun.file(reportFile).text()).toBe("source task evidence\n");
	});

	it("atomically replaces a destination symlink without changing its target", async () => {
		const runsDirectory = join(temporaryDirectory, "comparison-output");
		const manifestSha = digest(await Bun.file(fixture.manifestFile).text());
		const { reportFile } = comparisonReportPaths(runsDirectory, manifestSha);
		const symlinkTarget = join(temporaryDirectory, "outside-report.json");
		await mkdir(dirname(reportFile), { recursive: true });
		await Bun.write(symlinkTarget, "outside bytes\n");
		await symlink(symlinkTarget, reportFile);

		await writeComparisonReport({
			manifestPath: fixture.manifestFile,
			runsDirectory,
		});

		const reportStats = await lstat(reportFile);
		expect(reportStats.isSymbolicLink()).toBe(false);
		expect(await Bun.file(symlinkTarget).text()).toBe("outside bytes\n");
		const report = parseComparisonReport(await Bun.file(reportFile).text());
		expect(report.cases).toHaveLength(2);
	});

	it("writes one read-only comparison report without external execution", async () => {
		const trapsDirectory = join(temporaryDirectory, "traps");
		const externalCallMarker = join(
			temporaryDirectory,
			"unexpected-external-call",
		);
		await mkdir(trapsDirectory);
		for (const command of ["claude", "git"]) {
			const trap = join(trapsDirectory, command);
			await Bun.write(
				trap,
				'#!/bin/sh\ntouch "$EXTERNAL_CALL_MARKER"\nexit 97\n',
			);
			await chmod(trap, 0o755);
		}
		const before = await directoryDigests(temporaryDirectory);

		const output = await runCommand(
			[
				process.execPath,
				"run",
				join(CONTROL_DIR, "compare-confirmations.ts"),
				fixture.manifestFile,
			],
			CONTROL_DIR,
			{
				env: {
					EXTERNAL_CALL_MARKER: externalCallMarker,
					PATH: `${trapsDirectory}:${Bun.env["PATH"] ?? ""}`,
				},
			},
		);
		writtenReportFile = output.trim().replace("Comparison report: ", "");
		const after = await directoryDigests(temporaryDirectory);
		const report = parseComparisonReport(
			await Bun.file(writtenReportFile).text(),
		);

		expect(output).toBe(`Comparison report: ${writtenReportFile}\n`);
		expect(writtenReportFile).toContain(
			join(".benchmark-runs", "comparisons", report.manifest.sha256),
		);
		expect(report.cases).toHaveLength(2);
		expect(after).toEqual(before);
		expect(await Bun.file(externalCallMarker).exists()).toBe(false);
	});
});
