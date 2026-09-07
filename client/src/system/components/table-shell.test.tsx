import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { TableShell } from "./table-shell";

describe(TableShell.name, () => {
	it("renders the caption as a visual section label", () => {
		render(
			<TableShell
				caption="DURABLE RECORDS"
				columns={["Run", "Case"]}
				rows={[["r-0148", "auth-refactor"]]}
			/>,
		);

		expect(screen.getByText("DURABLE RECORDS")).toBeInTheDocument();
	});

	it("renders one column header per declared column", () => {
		render(
			<TableShell
				caption="DURABLE RECORDS"
				columns={["Run", "Case", "Outcome"]}
				rows={[]}
			/>,
		);

		expect(
			screen.getByRole("columnheader", { name: "Run" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Case" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Outcome" }),
		).toBeInTheDocument();
	});

	it("renders one row per declared row, cells in column order", () => {
		render(
			<TableShell
				caption="DURABLE RECORDS"
				columns={["Run", "Case"]}
				rows={[
					["r-0148", "auth-refactor"],
					["r-0147", "doc-rewrite"],
				]}
			/>,
		);

		const rows = screen.getAllByRole("row");
		// header row + 2 data rows
		expect(rows).toHaveLength(3);
		expect(screen.getByText("r-0148")).toBeInTheDocument();
		expect(screen.getByText("doc-rewrite")).toBeInTheDocument();
	});
});
