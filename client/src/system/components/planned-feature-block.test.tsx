import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { PlannedFeatureBlock } from "./planned-feature-block";

describe(PlannedFeatureBlock.name, () => {
	it("renders its heading, a PLANNED pill, and the not-available note", () => {
		render(
			<PlannedFeatureBlock heading="Edit an instruction, review, then apply">
				Body content
			</PlannedFeatureBlock>,
		);

		expect(
			screen.getByRole("heading", {
				name: "Edit an instruction, review, then apply",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("PLANNED")).toBeInTheDocument();
		expect(screen.getByText(/Not available in v0\.6/u)).toBeInTheDocument();
	});

	it("renders its children as the block's body", () => {
		render(
			<PlannedFeatureBlock heading="Edit an instruction, review, then apply">
				Body content
			</PlannedFeatureBlock>,
		);

		expect(screen.getByText("Body content")).toBeInTheDocument();
	});
});
