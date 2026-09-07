import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Grade } from "./grade";

describe(Grade.name, () => {
	it("renders the letter grade", () => {
		render(<Grade value="A−" size="13" />);

		expect(screen.getByText("A−")).toBeInTheDocument();
	});

	it("renders a pending grade as an em dash, muted", () => {
		render(<Grade value="pending" size="13" />);

		const dash = screen.getByText("—");
		expect(dash).toBeInTheDocument();
		expect(dash).toHaveClass("rh-grade--pending");
	});

	it.each(["12", "13", "19", "20", "22", "24", "26", "30"] as const)(
		"applies the %spx size as a class",
		(size) => {
			render(<Grade value="B+" size={size} />);

			expect(screen.getByText("B+")).toHaveClass(`rh-grade--${size}`);
		},
	);
});
