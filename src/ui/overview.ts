import type { ListKind, RecordListing } from "#cli/list-command";
import { LIST_KINDS, listRecords } from "#cli/list-command";

export interface OverviewSection extends RecordListing {
	readonly kind: ListKind;
}

export interface Overview {
	readonly sections: readonly OverviewSection[];
}

async function readSection(
	kind: ListKind,
	runsDirectory: string,
): Promise<OverviewSection> {
	const { entries, unreadable } = await listRecords(kind, runsDirectory);

	return { kind, entries, unreadable };
}

export async function readOverview(runsDirectory: string): Promise<Overview> {
	return {
		sections: await Promise.all(
			LIST_KINDS.map((kind) => readSection(kind, runsDirectory)),
		),
	};
}
