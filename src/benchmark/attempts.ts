import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CommandError, runCommand } from "./command";
import type { ContextFile } from "./contracts";
import { stageLetterGradeSchema } from "./contracts";
import { readReplayRecord } from "./replay";

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
					z
						.object({ id: z.string(), grade: stageLetterGradeSchema })
						.passthrough(),
				),
			})
			.passthrough(),
		input: z
			.object({
				artifact: z
					.object({ path: z.string(), content: z.string() })
					.passthrough()
					.optional(),
				diff: z.string().optional(),
				changedPaths: z.array(z.string()).optional(),
			})
			.passthrough(),
	})
	.passthrough();

type AttemptScorecard = z.infer<typeof attemptScorecardSchema>;

function attemptFromScorecard(
	label: string,
	scorecard: AttemptScorecard,
	totalCostUsd?: number,
): Attempt {
	const { artifact, changedPaths, diff } = scorecard.input;

	return {
		label,
		grade: scorecard.grade.grade,
		verdict: scorecard.grade.verdict,
		dimensions: scorecard.grade.dimensions,
		judgeCostUsd: scorecard.costUsd,
		...(totalCostUsd === undefined ? {} : { totalCostUsd }),
		...(artifact === undefined ? {} : { artifact }),
		...(changedPaths === undefined ? {} : { changedPaths }),
		...(diff === undefined ? {} : { diff }),
	};
}

/**
 * The original run's stage file holds its scorecard only when the stage was
 * judged; a pending or failed marker is not an attempt. The stage session's
 * own cost lives in the run artifact, not the stage file, so the original
 * attempt carries no total.
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
			["git", "diff", "--no-index", "--", "before", "after"],
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
		if (attempt.changedPaths?.length) {
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
