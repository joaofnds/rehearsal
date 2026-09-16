import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Disclosure } from "./disclosure";

describe(Disclosure.name, () => {
	it("renders the collapsed label as a button and hides its content", () => {
		render(
			<Disclosure collapsedLabel="2 causes" expandedLabel="hide causes">
				<p>CLAUDE.md changed</p>
			</Disclosure>,
		);

		expect(
			screen.getByRole("button", { name: "2 causes" }),
		).toBeInTheDocument();
		expect(screen.queryByText("CLAUDE.md changed")).not.toBeInTheDocument();
	});

	it("marks aria-expanded false while collapsed", () => {
		render(
			<Disclosure collapsedLabel="2 causes" expandedLabel="hide causes">
				<p>CLAUDE.md changed</p>
			</Disclosure>,
		);

		expect(screen.getByRole("button", { name: "2 causes" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});

	describe("when the button is pressed", () => {
		it("reveals the content and takes the expanded label", () => {
			render(
				<Disclosure collapsedLabel="2 causes" expandedLabel="hide causes">
					<p>CLAUDE.md changed</p>
				</Disclosure>,
			);

			fireEvent.click(screen.getByRole("button", { name: "2 causes" }));

			expect(screen.getByText("CLAUDE.md changed")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "hide causes" }),
			).toHaveAttribute("aria-expanded", "true");
		});

		it("collapses again when pressed a second time", () => {
			render(
				<Disclosure collapsedLabel="2 causes" expandedLabel="hide causes">
					<p>CLAUDE.md changed</p>
				</Disclosure>,
			);

			fireEvent.click(screen.getByRole("button", { name: "2 causes" }));
			fireEvent.click(screen.getByRole("button", { name: "hide causes" }));

			expect(screen.queryByText("CLAUDE.md changed")).not.toBeInTheDocument();
		});
	});
});
