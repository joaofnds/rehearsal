import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

describe("client entry", () => {
	it("names Rehearse in the browser title", async () => {
		const entryFile = fileURLToPath(new URL("../index.html", import.meta.url));
		const html = await readFile(entryFile, "utf8");
		const document = new DOMParser().parseFromString(html, "text/html");

		expect(document).not.toBeNull();
		expect(document?.title).toBe("Rehearse");
	});
});
