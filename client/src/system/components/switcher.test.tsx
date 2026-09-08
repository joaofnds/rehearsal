import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Switcher } from "./switcher";

describe(Switcher.name, () => {
	it("marks the selected option pressed and the rest not", () => {
		render(
			<Switcher
				label="Comparison presentation"
				options={["Attempt pairs", "What moved"]}
				selected="Attempt pairs"
				onSelect={() => undefined}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Attempt pairs", pressed: true }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "What moved", pressed: false }),
		).toBeInTheDocument();
	});

	it("exposes the switcher as a labeled group", () => {
		render(
			<Switcher
				label="Comparison presentation"
				options={["Attempt pairs", "What moved"]}
				selected="Attempt pairs"
				onSelect={() => undefined}
			/>,
		);

		expect(
			screen.getByRole("group", { name: "Comparison presentation" }),
		).toBeInTheDocument();
	});

	it("calls onSelect with the clicked option", () => {
		const selections: string[] = [];
		render(
			<Switcher
				label="Comparison presentation"
				options={["Attempt pairs", "What moved"]}
				selected="Attempt pairs"
				onSelect={(option) => {
					selections.push(option);
				}}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "What moved" }));

		expect(selections).toEqual(["What moved"]);
	});
});
