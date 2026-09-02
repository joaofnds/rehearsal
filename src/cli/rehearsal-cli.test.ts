import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComparisonEvidenceFixture } from "#benchmark/comparison-evidence-test-support";
import { parseComparisonReport } from "#benchmark/comparison-record";
import { CONTROL_DIR } from "#benchmark/config";
import {
	benchmarkRunsDirectory,
	comparisonReportPaths,
} from "#benchmark/run-layout";
import { COMMANDS } from "#cli/commands";
import { PROJECT_ROOT } from "#benchmark/test-support";

interface CliResult {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
}

async function runCli(
	args: readonly string[],
	stdin: "inherit" | "empty" = "empty",
): Promise<CliResult> {
	const child = Bun.spawn([process.execPath, "rehearsal.ts", ...args], {
		cwd: PROJECT_ROOT,
		stdin: stdin === "empty" ? new Blob([""]) : "inherit",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return { exitCode, stdout, stderr };
}

describe("rehearsal", () => {
	const temporaryDirectories: string[] = [];
	let writtenReportDirectory: string | undefined;

	afterEach(async () => {
		if (writtenReportDirectory !== undefined) {
			await rm(writtenReportDirectory, { force: true, recursive: true });
			writtenReportDirectory = undefined;
		}
		await Promise.all(
			temporaryDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("lists every command and the exit-code meanings in the top-level help", async () => {
		const result = await runCli(["--help"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		for (const command of COMMANDS) {
			expect(result.stdout).toContain(command.name);
			expect(result.stdout).toContain(command.summary);
		}
		expect(result.stdout).toContain("2  usage error");
		expect(result.stdout).toContain("3  refused precondition");
	});

	it.each(COMMANDS.map((command) => command.name))(
		"prints the flag table for rehearsal %s --help",
		async (name) => {
			const command = COMMANDS.find((candidate) => candidate.name === name);
			const result = await runCli([name, "--help"]);

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toBe("");
			for (const flag of command?.flags ?? []) {
				expect(result.stdout).toContain(flag.name);
				expect(result.stdout).toContain(flag.help);
				if (flag.envVar !== undefined) {
					expect(result.stdout).toContain(flag.envVar);
				}
			}
		},
	);

	it("prints the top-level help on stderr and exits 2 with no command", async () => {
		const result = await runCli([]);

		expect(result.exitCode).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Usage: rehearsal <command>");
		for (const command of COMMANDS) {
			expect(result.stderr).toContain(command.name);
		}
	});

	it("prints only the report path for a valid manifest, and nothing on stdout otherwise", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-cli-compare-"));
		temporaryDirectories.push(directory);
		const fixture = new ComparisonEvidenceFixture(directory);
		await fixture.write();
		const manifestSha = createHash("sha256")
			.update(await Bun.file(fixture.manifestFile).text())
			.digest("hex");
		const { directory: reportDirectory, reportFile } = comparisonReportPaths(
			benchmarkRunsDirectory(CONTROL_DIR),
			manifestSha,
		);

		const result = await runCli(["compare", fixture.manifestFile]);
		writtenReportDirectory = reportDirectory;

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe(`${reportFile}\n`);
		expect(result.stderr).toBe("");
	});

	it("prints exactly the report JSON on stdout with --json", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-cli-compare-"));
		temporaryDirectories.push(directory);
		const fixture = new ComparisonEvidenceFixture(directory);
		await fixture.write();
		const manifestSha = createHash("sha256")
			.update(await Bun.file(fixture.manifestFile).text())
			.digest("hex");
		const { directory: reportDirectory, reportFile } = comparisonReportPaths(
			benchmarkRunsDirectory(CONTROL_DIR),
			manifestSha,
		);

		const result = await runCli(["compare", fixture.manifestFile, "--json"]);
		writtenReportDirectory = reportDirectory;

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toBe(await Bun.file(reportFile).text());
		expect(parseComparisonReport(result.stdout).cases).toHaveLength(2);
		expect(JSON.parse(result.stdout)).toEqual(
			JSON.parse(await Bun.file(reportFile).text()),
		);
	});

	it("refuses an unknown flag by name, with a usage exit code and no stdout", async () => {
		const result = await runCli(["run", "--bogus"]);

		expect(result.exitCode).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("--bogus");
		expect(result.stderr.trim().split("\n")).toHaveLength(1);
	});

	it("refuses a confirmation replay without --yes when stdin is not a terminal", async () => {
		const result = await runCli([
			"replay",
			"--run",
			"any-name",
			"--stage",
			"shape",
			"--model",
			"sonnet",
			"--session-budget-usd",
			"1",
			"--confirm",
		]);

		expect(result.exitCode).toBe(3);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("stdin is not a terminal");
		expect(result.stderr).not.toContain("Projected maximum cost");
		expect(result.stderr).not.toContain("No replayable run named");
	});

	it("does not refuse for a terminal when --yes answers the approval", async () => {
		const result = await runCli([
			"replay",
			"--run",
			"any-name",
			"--stage",
			"shape",
			"--model",
			"sonnet",
			"--session-budget-usd",
			"1",
			"--confirm",
			"--yes",
		]);

		expect(result.exitCode).toBe(3);
		expect(result.stdout).toBe("");
		expect(result.stderr).not.toContain("stdin is not a terminal");
		expect(result.stderr).toContain("No replayable run named any-name");
	});

	it("refuses to run when stdin is not a terminal, before any provider call", async () => {
		const result = await runCli([
			"run",
			"--target",
			"/nonexistent-target",
			"--model",
			"sonnet",
			"--session-budget-usd",
			"1",
		]);

		expect(result.exitCode).toBe(3);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("ACT-26.3");
		expect(result.stderr).not.toContain("Target:");
	});

	it.each([
		{
			condition: "a required flag is missing",
			args: ["run", "--model", "sonnet", "--session-budget-usd", "1"],
			message: "Provide --target or BENCHMARK_TARGET_DIR",
		},
		{
			condition: "a flag value is unparseable",
			args: [
				"run",
				"--target",
				"/nonexistent",
				"--model",
				"sonnet",
				"--effort",
				"extreme",
				"--session-budget-usd",
				"1",
			],
			message: "Unsupported effort for workflow: extreme",
		},
		{
			condition: "a flag is given no value",
			args: ["run", "--model"],
			message: "Flag --model needs a value",
		},
	])(
		"exits 2 with the reason on stderr when $condition",
		async ({ args, message }) => {
			const result = await runCli(args);

			expect(result.exitCode).toBe(2);
			expect(result.stdout).toBe("");
			expect(result.stderr).toContain(message);
		},
	);
});
