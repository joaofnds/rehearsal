import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { GRADE_SIZES, Grade } from "./grade";

describe(Grade.name, () => {
	it("renders the letter grade", () => {
		render(<Grade value={{ letter: "A−" }} size="13" />);

		expect(screen.getByText("A−")).toBeInTheDocument();
	});

	it("renders a pending grade as an em dash, muted", () => {
		render(<Grade value={{ pending: true }} size="13" />);

		const dash = screen.getByText("—");
		expect(dash).toBeInTheDocument();
		expect(dash).toHaveClass("rh-grade--pending");
	});

	it.each([...GRADE_SIZES])("applies the %spx size as a class", (size) => {
		render(<Grade value={{ letter: "B+" }} size={size} />);

		expect(screen.getByText("B+")).toHaveClass(`rh-grade--${size}`);
	});
});
