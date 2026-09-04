import { UsageError } from "#cli/commands";
import { parseRecordId } from "#cli/record-id";
import { recordFileFor } from "#cli/show-command";
import { readOverview } from "#ui/overview";
import { renderOverview } from "#ui/render";

const RECORD_PREFIX = "/record/";

function html(body: string): Response {
	return new Response(body, {
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

function problem(status: number, message: string): Response {
	return Response.json({ error: message }, { status });
}

async function serveRecord(
	id: string,
	runsDirectory: string,
): Promise<Response> {
	let file: string;
	try {
		file = recordFileFor(parseRecordId(id), runsDirectory);
	} catch (error) {
		if (error instanceof UsageError) {
			return problem(400, error.message);
		}

		throw error;
	}

	const record = Bun.file(file);
	if (!(await record.exists())) {
		return problem(404, `No record ${id} at ${file}`);
	}

	return new Response(record, {
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

/**
 * Takes the URL rather than the request because the whole of what a read-only
 * page needs is the path, and a narrower parameter is one the caller cannot
 * hand a consumed body.
 */
export async function handleUrl(
	url: string,
	runsDirectory: string,
): Promise<Response> {
	const { pathname } = new URL(url);

	if (pathname === "/") {
		return html(renderOverview(await readOverview(runsDirectory)));
	}

	if (pathname.startsWith(RECORD_PREFIX)) {
		return serveRecord(
			decodeURIComponent(pathname.slice(RECORD_PREFIX.length)),
			runsDirectory,
		);
	}

	return problem(404, `No route for ${pathname}`);
}

export function startServer(
	runsDirectory: string,
	port: number,
): Bun.Server<undefined> {
	return Bun.serve({
		port,
		fetch: (request: Request) => handleUrl(request.url, runsDirectory),
	});
}
