import { z } from "zod";

const UNAVAILABLE = { state: "unavailable" } as const;

const instructionFileSchema = z
	.object({
		path: z.string().min(1),
		type: z.string().min(1),
	})
	.loose();

const instructionsAttachmentSchema = z
	.object({
		attachment: z
			.object({
				type: z.literal("instructions"),
				files: z.array(instructionFileSchema),
			})
			.loose(),
	})
	.loose();

export interface TranscriptInstructionLoad {
	readonly filePath: string;
	readonly memoryType: string;
	readonly loadReason: typeof UNAVAILABLE;
	readonly triggerFilePath: typeof UNAVAILABLE;
	readonly parentFilePath: typeof UNAVAILABLE;
}

export type TranscriptInstructionLoads =
	| {
			readonly state: "available";
			readonly loads: readonly TranscriptInstructionLoad[];
	  }
	| { readonly state: "unavailable" };

/**
 * The attachment names the file and its memory type and nothing else. Why the
 * file loaded, what triggered it and which file included it are absent from
 * the transcript, so they report unavailable rather than a guess a reader
 * would take for evidence.
 */
export function transcriptInstructionLoads(
	transcript: string,
): TranscriptInstructionLoads {
	const loads: TranscriptInstructionLoad[] = [];
	let sawAttachment = false;
	for (const line of transcript.split("\n")) {
		if (line.trim() === "") {
			continue;
		}
		let row: unknown;
		try {
			row = JSON.parse(line);
		} catch {
			continue;
		}
		const parsed = instructionsAttachmentSchema.safeParse(row);
		if (!parsed.success) {
			continue;
		}
		sawAttachment = true;
		for (const file of parsed.data.attachment.files) {
			loads.push({
				filePath: file.path,
				memoryType: file.type,
				loadReason: UNAVAILABLE,
				triggerFilePath: UNAVAILABLE,
				parentFilePath: UNAVAILABLE,
			});
		}
	}
	if (!sawAttachment) {
		return UNAVAILABLE;
	}

	return { state: "available", loads };
}
