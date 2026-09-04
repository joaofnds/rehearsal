import { describe, expect, it } from "bun:test";
import { escapeHtml, renderOverview } from "#ui/render";

describe("escapeHtml", () => {
	it("neutralizes the characters that would open a tag or close an attribute", () => {
		expect(escapeHtml(`<script>"&"</script>`)).toBe(
			"&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;",
		);
	});

	it("escapes the ampersand before the entities it introduces", () => {
		expect(escapeHtml("&lt;")).toBe("&amp;lt;");
	});
});

describe("renderOverview", () => {
	it("renders a record id as text rather than as markup", () => {
		const page = renderOverview({
			sections: [
				{
					kind: "runs",
					entries: [{ id: `<img src=x onerror=alert(1)>`, fields: [] }],
					unreadable: [],
				},
			],
		});

		expect(page).not.toContain("<img");
		expect(page).toContain("&lt;img");
	});

	it("says a section is empty rather than rendering an empty list", () => {
		const page = renderOverview({
			sections: [{ kind: "groups", entries: [], unreadable: [] }],
		});

		expect(page).toContain("Nothing recorded.");
		expect(page).not.toContain("<ul>");
	});
});
