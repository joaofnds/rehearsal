import { SymlinkedEntryError } from "#benchmark/file-presence";
import type { StaleCliConfig } from "#benchmark/config";
import { CorpusFileError } from "#benchmark/corpus-file";
import type { ResolvedCorpusSource } from "#benchmark/corpus-source";
import {
	CorpusSourceError,
	resolveCorpusSource,
} from "#benchmark/corpus-source";
import type { StaleRecord } from "#benchmark/staleness-report";
import { staleCases, staleCheckpoints } from "#benchmark/staleness-report";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import { writeUnreadable } from "#cli/output";

/**
 * The knobs a session is about to replay with, not the ones a run was recorded
 * with: comparing a checkpoint against its own manifest is tautologically equal,
 * so the model and effort come from the flags and the environment the way
 * `replay` reads them.
 */
export interface StaleRequest extends StaleCliConfig {
	readonly runsDirectory: string;
}

export interface StaleDependencies {
	readonly output: CommandOutput;
}

/**
 * A corpus that does not resolve, or that lacks a file a recorded checkpoint
 * has to be compared against, is a precondition the command refuses rather
 * than a malformed command line: `--corpus /absent` is well formed and names a
 * directory that is not there, which is the same shape as a case id naming no
 * case.
 */
async function refusingCorpusFailures<Answer>(
	work: () => Promise<Answer>,
): Promise<Answer> {
	try {
		return await work();
	} catch (error) {
		if (
			error instanceof CorpusSourceError ||
			error instanceof CorpusFileError ||
			error instanceof SymlinkedEntryError
		) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

function line(record: StaleRecord): string {
	return `${[record.id, ...record.causes].join("\t")}\n`;
}

/**
 * Reports what an edit invalidated and delivers nothing, so unlike run and
 * replay it accepts `--corpus` for a stage's skills: the refusal those two
 * make exists because a project-level skill cannot shadow a user-level one,
 * and hashing a skill needs no install at all.
 */
export async function runStale(
	request: StaleRequest,
	dependencies: StaleDependencies,
): Promise<void> {
	const source = await refusingCorpusFailures(() =>
		resolveCorpusSource(request.corpus),
	);

	await report(request, source, dependencies.output);
}

async function report(
	request: StaleRequest,
	source: ResolvedCorpusSource,
	output: CommandOutput,
): Promise<void> {
	const cases = await staleCases(request.runsDirectory, source);
	const stale = [
		...(await refusingCorpusFailures(() =>
			staleCheckpoints(request.runsDirectory, source, request),
		)),
		...cases.records,
	];

	writeUnreadable(output, cases.unreadable);
	for (const record of stale) {
		output.stdout(line(record));
	}
}
