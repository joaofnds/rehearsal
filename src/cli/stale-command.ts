import type { CorpusSourceDependencies } from "#benchmark/corpus-source";
import {
	CorpusSourceError,
	defaultCorpusSourceDependencies,
	resolveCorpusSource,
} from "#benchmark/corpus-source";
import type { StaleRecord } from "#benchmark/staleness-report";
import { staleCases, staleCheckpoints } from "#benchmark/staleness-report";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";

export interface StaleRequest {
	readonly corpus: string | undefined;
	readonly runsDirectory: string;
}

export interface StaleDependencies {
	readonly output: CommandOutput;
	readonly corpusSource?: CorpusSourceDependencies | undefined;
}

/**
 * A corpus source that does not resolve is a precondition the command refuses,
 * not a malformed command line: `--corpus /absent` is well formed and names a
 * directory that is not there, which is the same shape as a case id naming no
 * case.
 */
async function resolved(
	corpus: string | undefined,
	dependencies: CorpusSourceDependencies,
): Promise<Awaited<ReturnType<typeof resolveCorpusSource>>> {
	try {
		return await resolveCorpusSource(corpus, dependencies);
	} catch (error) {
		if (error instanceof CorpusSourceError) {
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
	const source = await resolved(
		request.corpus,
		dependencies.corpusSource ?? defaultCorpusSourceDependencies(),
	);
	const stale = [
		...(await staleCheckpoints(request.runsDirectory, source)),
		...(await staleCases(request.runsDirectory, source)),
	];

	for (const record of stale) {
		dependencies.output.stdout(line(record));
	}
}
