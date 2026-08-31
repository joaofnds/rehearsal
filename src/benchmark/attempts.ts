import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CommandError, runCommand } from "./command";
import type { HashedFile } from "./checkpoint";
import type { ContextFile, Immutable } from "./contracts";
import { stageLetterGradeSchema } from "./contracts";
import { readReplayRecord } from "./replay";

/**
 * The inputs that produced the checkpoint an attempt consumed. Two attempts
 * are comparable only when these agree; a difference means the two ran
 * against different corpora and their grades measure different things.
 */
export interface AttemptLineageInputs {
	readonly corpusFiles: readonly HashedFile[];
	readonly model: string;
	readonly effort?: string | undefined;
}

export class LineageMismatchError extends Error {
	public override name = "LineageMismatchError";
}

/**
 * One execution of a stage at a checkpoint: the original run's stage result
 * or any replay. Only what a side-by-side presentation needs is read; the
 * full evidence stays in the record on disk.
 */
export interface Attempt {
	readonly label: string;
	readonly grade: string;
	readonly verdict: "CONTINUE" | "STOP";
	readonly dimensions: readonly {
		readonly id: string;
		readonly grade: string;
	}[];
	readonly judgeCostUsd: number;
	readonly totalCostUsd?: number | undefined;
	readonly artifact?: ContextFile | undefined;
	readonly changedPaths?: readonly string[] | undefined;
	readonly diff?: string | undefined;
	readonly lineageInputs?: AttemptLineageInputs | undefined;
}

const attemptScorecardSchema = z
	.object({
		stage: z.string().min(1),
		costUsd: z.number(),
		grade: z
			.object({
				grade: stageLetterGradeSchema,
				verdict: z.enum(["CONTINUE", "STOP"]),
				dimensions: z.array(
					z.object({ id: z.string(), grade: stageLetterGradeSchema }).loose(),
				),
			})
			.loose(),
		input: z
			.object({
				artifact: z
					.object({ path: z.string(), content: z.string() })
					.loose()
					.optional(),
				diff: z.string().optional(),
				changedPaths: z.array(z.string()).optional(),
			})
			.loose(),
	})
	.loose();

type AttemptScorecard = Immutable<z.infer<typeof attemptScorecardSchema>>;

function attemptFromScorecard(
	label: string,
	scorecard: AttemptScorecard,
	totalCostUsd?: number,
	lineageInputs?: AttemptLineageInputs,
): Attempt {
	const { artifact, changedPaths, diff } = scorecard.input;

	return {
		label,
		grade: scorecard.grade.grade,
		verdict: scorecard.grade.verdict,
		dimensions: scorecard.grade.dimensions,
		judgeCostUsd: scorecard.costUsd,
		totalCostUsd,
		artifact,
		changedPaths,
		diff,
		lineageInputs,
	};
}

/**
 * The original run's stage file holds its scorecard only when the stage was
 * judged; a pending or failed marker is not an attempt. The stage session's
 * own cost lives in the run artifact, not the stage file, so the original
 * attempt carries neither a total nor lineage inputs: the guard compares the
 * replays it can see rather than assuming the original's inputs.
 */
async function loadOriginalAttempt(
	runsDirectory: string,
	runName: string,
	stage: string,
): Promise<Attempt | undefined> {
	const file = Bun.file(join(runsDirectory, `${runName}.${stage}.json`));
	if (!(await file.exists())) {
		return undefined;
	}

	const parsed = attemptScorecardSchema.safeParse(
		JSON.parse(await file.text()),
	);
	if (!parsed.success) {
		return undefined;
	}

	return attemptFromScorecard(`original run ${runName}`, parsed.data);
}

/**
 * Every attempt at one checkpoint: the original stage result, then each
 * replay in the order it was recorded. Grouping needs no search because
 * replay records live under the consumed checkpoint's lineage.
 */
export async function loadAttempts(
	runsDirectory: string,
	runName: string,
	stage: string,
	lineage: string,
): Promise<Attempt[]> {
	const attempts: Attempt[] = [];
	const original = await loadOriginalAttempt(runsDirectory, runName, stage);
	if (original) {
		attempts.push(original);
	}

	const replaysDirectory = join(runsDirectory, "replays", lineage);
	let entries: string[] = [];
	try {
		const replayEntries = await readdir(replaysDirectory);
		entries = replayEntries.filter((entry) => entry.endsWith(".json"));
	} catch (error) {
		if (
			!(error instanceof Error && "code" in error && error.code === "ENOENT")
		) {
			throw error;
		}
	}

	for (const entry of entries.toSorted()) {
		const record = await readReplayRecord(join(replaysDirectory, entry));
		attempts.push(
			attemptFromScorecard(
				`replay ${record.timestamp}`,
				attemptScorecardSchema.parse(record.scorecard),
				record.stageCostUsd + record.productOwnerCostUsd + record.judgeCostUsd,
				{
					corpusFiles: record.corpusFiles,
					model: record.model,
					effort: record.effort,
				},
			),
		);
	}

	return attempts;
}

export async function diffTexts(
	before: string,
	after: string,
): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "rehearsal-diff-"));

	try {
		await Bun.write(join(directory, "before"), before);
		await Bun.write(join(directory, "after"), after);
		await runCommand(
			[
				"git",
				"diff",
				"--no-ext-diff",
				"--no-color",
				"--no-index",
				"--",
				"before",
				"after",
			],
			directory,
		);

		return "";
	} catch (error) {
		// git diff --no-index exits 1 when the files differ; that is the diff.
		if (error instanceof CommandError && error.exitCode === 1) {
			return error.stdout;
		}

		throw error;
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}

function attemptContent(attempt: Attempt): string | undefined {
	return attempt.artifact?.content ?? attempt.diff;
}

function lineageDifferences(
	reference: AttemptLineageInputs,
	other: AttemptLineageInputs,
): string[] {
	const differences: string[] = [];
	if (reference.model !== other.model) {
		differences.push(`model ${reference.model} against ${other.model}`);
	}
	if (reference.effort !== other.effort) {
		differences.push(
			`effort ${reference.effort ?? "none"} against ${other.effort ?? "none"}`,
		);
	}

	const otherByPath = new Map(
		other.corpusFiles.map((file) => [file.path, file.sha256]),
	);
	for (const file of reference.corpusFiles) {
		const counterpart = otherByPath.get(file.path);
		if (counterpart === undefined) {
			differences.push(`${file.path} present in one attempt only`);
			continue;
		}
		if (counterpart !== file.sha256) {
			differences.push(`${file.path} differs`);
		}

		otherByPath.delete(file.path);
	}
	for (const path of otherByPath.keys()) {
		differences.push(`${path} present in one attempt only`);
	}

	return differences.toSorted();
}

/**
 * Grades from different corpora measure different things, so a side-by-side
 * presentation of them would mislead rather than inform. Attempts recorded
 * before lineage inputs existed carry none and are presented as before,
 * because refusing them would break reading of every earlier run.
 */
function assertComparableLineages(attempts: readonly Attempt[]): void {
	const labelled = attempts.filter(
		(attempt): attempt is Attempt & { lineageInputs: AttemptLineageInputs } =>
			attempt.lineageInputs !== undefined,
	);
	const [reference] = labelled;
	if (!reference) {
		return;
	}

	for (const attempt of labelled.slice(1)) {
		const differences = lineageDifferences(
			reference.lineageInputs,
			attempt.lineageInputs,
		);
		if (differences.length > 0) {
			throw new LineageMismatchError(
				`Cannot compare ${reference.label} with ${attempt.label}: they consumed different inputs (${differences.join("; ")})`,
			);
		}
	}
}

/**
 * Grades and cost line up for scanning; the latest attempt is then diffed
 * against each earlier one. For a delivery stage the comparable content is
 * the build diff itself.
 */
export async function presentAttempts(
	lineage: string,
	attempts: readonly Attempt[],
	diff: typeof diffTexts = diffTexts,
): Promise<string> {
	assertComparableLineages(attempts);
	const lines = [`Attempts at checkpoint ${lineage}:`];

	for (const [index, attempt] of attempts.entries()) {
		const dimensions = attempt.dimensions
			.map(({ id, grade }) => `${id} ${grade}`)
			.join(", ");
		const cost =
			attempt.totalCostUsd === undefined
				? `judge $${attempt.judgeCostUsd.toFixed(2)}`
				: `judge $${attempt.judgeCostUsd.toFixed(2)}, total $${attempt.totalCostUsd.toFixed(2)}`;
		lines.push(
			`${index + 1}. ${attempt.label} — grade ${attempt.grade} (${attempt.verdict}), ${cost}${dimensions ? ` [${dimensions}]` : ""}`,
		);
		if (attempt.changedPaths !== undefined && attempt.changedPaths.length > 0) {
			lines.push(`   changed paths: ${attempt.changedPaths.join(", ")}`);
		}
	}

	const latest = attempts.at(-1);
	const latestContent = latest ? attemptContent(latest) : undefined;
	if (latest && latestContent !== undefined) {
		for (const earlier of attempts.slice(0, -1)) {
			const earlierContent = attemptContent(earlier);
			if (earlierContent === undefined) {
				continue;
			}

			const changes = await diff(earlierContent, latestContent);
			lines.push(
				"",
				`Diff, ${earlier.label} → ${latest.label}:`,
				changes || "(identical)",
			);
		}
	}

	return lines.join("\n");
}
