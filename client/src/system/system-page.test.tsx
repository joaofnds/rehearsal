import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { STATUS_STATES } from "./components/status";
import { SystemPage } from "./system-page";

describe(SystemPage.name, () => {
	it("renders a swatch for every color token", () => {
		render(<SystemPage />);

		expect(screen.getByText("--color-canvas")).toBeInTheDocument();
		expect(screen.getByText("--color-accent")).toBeInTheDocument();
		expect(screen.getByText("--color-diff-remove")).toBeInTheDocument();
	});

	it("renders every status state", () => {
		render(<SystemPage />);

		for (const state of STATUS_STATES) {
			expect(
				screen.getAllByText(state.replaceAll("-", " ")).length,
			).toBeGreaterThan(0);
		}
	});

	it("renders every grade size", () => {
		render(<SystemPage />);

		expect(screen.getByText("12px")).toBeInTheDocument();
		expect(screen.getByText("30px")).toBeInTheDocument();
	});

	it("renders the corpus pill, section label, filter pill, and table shell", () => {
		render(<SystemPage />);

		expect(screen.getByText("corpus@a41c7e")).toBeInTheDocument();
		expect(screen.getByText("DURABLE RECORDS")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "All 148" })).toBeInTheDocument();
		expect(screen.getByRole("table")).toBeInTheDocument();
	});

	it("names each undone component against the screen card that will need it first", () => {
		render(<SystemPage />);

		expect(screen.getByText(/evidence disclosure/iu)).toBeInTheDocument();
		expect(screen.getAllByText(/ACT-51/u).length).toBeGreaterThan(0);
		expect(screen.getByText(/step node card/iu)).toBeInTheDocument();
		expect(screen.getByText(/stat card/iu)).toBeInTheDocument();
		expect(screen.getByText(/planned-feature block/iu)).toBeInTheDocument();
		expect(screen.getByText(/ACT-50/u)).toBeInTheDocument();
		expect(screen.getByText(/dialog shell/iu)).toBeInTheDocument();
	});
});
