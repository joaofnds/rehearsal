import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ConfirmationCostProjection } from "./confirmation";
import type { Effort } from "./config";
import type { ClaudeCallMetrics, ProviderCall } from "./contracts";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	confirmationGroupRecordSchema,
	confirmationRepRecordSchema,
} from "./confirmation-record";
import {
	buildReliabilityReport,
	buildResourceReport,
} from "./confirmation-report";

export type FrozenFile = ConfirmationGroupRecord["inputs"]["files"][number];

export async function writeFrozenFile(
	groupDirectory: string,
	path: string,
	content: string,
	kind: FrozenFile["kind"],
): Promise<FrozenFile> {
	await Bun.write(path, content);

	return {
		kind,
		path: relative(groupDirectory, path),
		sha256: createHash("sha256").update(content).digest("hex"),
	};
}

export async function frozenDirectoryFiles(
	groupDirectory: string,
	directory: string,
	kind: FrozenFile["kind"],
): Promise<readonly FrozenFile[]> {
	const files: FrozenFile[] = [];
	const entries = await readdir(directory, { recursive: true });
	for (const entry of entries.toSorted()) {
		const path = join(directory, entry);
		const file = Bun.file(path);
		if (!(await file.exists()) || file.type === "directory") {
			continue;
		}

		const bytes = await file.bytes();
		files.push({
			kind,
			path: relative(groupDirectory, path),
			sha256: createHash("sha256").update(bytes).digest("hex"),
		});
	}

	return files;
}

export interface ConfirmationRepResult {
	readonly recordFile: string;
	readonly preservedWorktree: boolean;
}

interface CompletedConfirmationRep {
	readonly targetRoot: string;
	readonly retentionName: string;
	readonly resultSha: string;
	readonly recordFile: string;
	readonly recordContent: string;
	readonly worktreePath: string;
	readonly recordRetentionRef: (
		targetRoot: string,
		retentionName: string,
		resultSha: string,
	) => Promise<void>;
	readonly removeWorktree: (
		targetRoot: string,
		worktreePath: string,
	) => Promise<void>;
}

export async function settleCompletedConfirmationRep(
	rep: Readonly<CompletedConfirmationRep>,
): Promise<ConfirmationRepResult> {
	await rep.recordRetentionRef(
		rep.targetRoot,
		rep.retentionName,
		rep.resultSha,
	);
	await Bun.write(rep.recordFile, rep.recordContent);
	await rep.removeWorktree(rep.targetRoot, rep.worktreePath);

	return { recordFile: rep.recordFile, preservedWorktree: false };
}

interface DiagnosticConfirmationRep {
	readonly recordFile: string;
	readonly recordContent: string;
	readonly worktreeCreated: boolean;
	readonly preservedMessage: string;
	readonly log: (message: string) => void;
}

export async function settleDiagnosticConfirmationRep(
	rep: Readonly<DiagnosticConfirmationRep>,
): Promise<ConfirmationRepResult> {
	await Bun.write(rep.recordFile, rep.recordContent);
	if (rep.worktreeCreated) {
		rep.log(rep.preservedMessage);
	}

	return {
		recordFile: rep.recordFile,
		preservedWorktree: rep.worktreeCreated,
	};
}

interface ConfirmationGroupFinalization {
	readonly mode: "stage" | "pipeline";
	readonly groupId: string;
	readonly reps: number;
	readonly declaredStages: readonly string[];
	readonly inputs: ConfirmationGroupInputs;
	readonly projectedCost: ConfirmationCostProjection;
	readonly approvalMethod: "interactive" | "yes";
	readonly repResults: readonly ConfirmationRepResult[];
	readonly worktreesDirectory: string;
	readonly groupDirectory: string;
	readonly groupFile: string;
	readonly reportFile: string;
	readonly makespanMs: number;
}

type ConfirmationGroupLineage =
	| { readonly kind: "SOURCE"; readonly sha: string }
	| {
			readonly kind: "CHECKPOINT";
			readonly lineage: string;
			readonly targetSha: string;
	  };

interface ConfirmationGroupInputs {
	readonly lineage: ConfirmationGroupLineage;
	readonly files: readonly Readonly<FrozenFile>[];
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly pipelinePath: string;
}

export interface ConfirmationGroupOutcome {
	readonly groupRecordFile: string;
	readonly reportFile: string;
	readonly repRecordFiles: readonly string[];
}

export async function finalizeConfirmationGroup(
	finalization: Readonly<ConfirmationGroupFinalization>,
): Promise<ConfirmationGroupOutcome> {
	const repRecordFiles = finalization.repResults.map(
		({ recordFile }) => recordFile,
	);
	const records = await Promise.all(
		repRecordFiles.map(async (path) =>
			confirmationRepRecordSchema.parse(
				JSON.parse(await Bun.file(path).text()),
			),
		),
	);
	const reliabilityInputs = records.map((record) => {
		if (finalization.mode === "stage") {
			return {
				metricsComplete: record.metrics.status === "COMPLETE",
				stages: record.stages,
				finalOutcome: { status: "NOT_REACHED" as const },
			};
		}
		if (record.finalOutcome.status === "NOT_APPLICABLE") {
			throw new Error(
				"Pipeline rep cannot have a not-applicable final outcome",
			);
		}

		return {
			metricsComplete: record.metrics.status === "COMPLETE",
			stages: record.stages,
			finalOutcome: record.finalOutcome,
		};
	});
	const reliability = buildReliabilityReport(
		finalization.declaredStages,
		reliabilityInputs,
	);
	const report = {
		reliability:
			finalization.mode === "stage"
				? reliability.slice(0, finalization.declaredStages.length)
				: reliability,
		resources: buildResourceReport(
			finalization.declaredStages,
			records,
			finalization.makespanMs,
		),
	};
	await Bun.write(
		finalization.reportFile,
		`${JSON.stringify(report, null, 2)}\n`,
	);
	const group = confirmationGroupRecordSchema.parse({
		schemaVersion: 1,
		groupId: finalization.groupId,
		mode: finalization.mode,
		reps: finalization.reps,
		declaredStages: finalization.declaredStages,
		inputs: finalization.inputs,
		projectedCost: finalization.projectedCost,
		approval: { method: finalization.approvalMethod, approved: true },
		repRecords: repRecordFiles.map((path, index) => ({
			repId: `${finalization.groupId}-rep-${index + 1}`,
			ordinal: index + 1,
			path: relative(finalization.groupDirectory, path),
		})),
		reportFile: relative(finalization.groupDirectory, finalization.reportFile),
		makespanMs: finalization.makespanMs,
	});
	await Bun.write(
		finalization.groupFile,
		`${JSON.stringify(group, null, 2)}\n`,
	);
	if (
		finalization.repResults.every(({ preservedWorktree }) => !preservedWorktree)
	) {
		await rm(finalization.worktreesDirectory, { force: true, recursive: true });
	}

	return {
		groupRecordFile: finalization.groupFile,
		reportFile: finalization.reportFile,
		repRecordFiles,
	};
}

type MetricRole = "worker" | "product-owner" | "stage-judge" | "final-judge";

export interface ConfirmationMetricAttempts {
	readonly worker: readonly ProviderCall[];
	readonly productOwner: readonly ProviderCall[] | undefined;
	readonly stageJudge: readonly ProviderCall[];
	readonly finalJudge: readonly ProviderCall[] | undefined;
}

interface RoleAttempts {
	readonly role: MetricRole;
	readonly attempts: readonly ProviderCall[];
}

export function collectConfirmationMetrics(
	attempts: ConfirmationMetricAttempts,
): Pick<ConfirmationRepRecord, "metrics" | "workerTrajectorySteps"> {
	const required: RoleAttempts[] = [
		{
			role: "worker",
			attempts: attempts.worker.length === 0 ? [{}] : attempts.worker,
		},
		{
			role: "product-owner",
			attempts: attempts.productOwner ?? [{}],
		},
		{
			role: "stage-judge",
			attempts: attempts.stageJudge.length === 0 ? [{}] : attempts.stageJudge,
		},
	];
	if (attempts.finalJudge !== undefined) {
		required.push({
			role: "final-judge",
			attempts: attempts.finalJudge.length === 0 ? [{}] : attempts.finalJudge,
		});
	}

	const calls: {
		readonly role: MetricRole;
		readonly metrics: ClaudeCallMetrics;
	}[] = [];
	const missing: string[] = [];
	for (const group of required) {
		for (const attempt of group.attempts) {
			if (attempt.metrics === undefined) {
				missing.push(`${group.role} call metrics`);

				continue;
			}

			calls.push({ role: group.role, metrics: attempt.metrics });
		}
	}
	const workerTrajectorySteps = calls
		.filter(({ role }) => role === "worker")
		.reduce((total, call) => total + call.metrics.turns, 0);

	return {
		metrics:
			missing.length === 0
				? { status: "COMPLETE", calls }
				: { status: "MISSING", calls, missing },
		workerTrajectorySteps,
	};
}
