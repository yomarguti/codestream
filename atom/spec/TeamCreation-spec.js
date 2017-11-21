import React from "react";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { mountWithIntl } from "./intl-test-helper.js";
import TeamCreation from "../lib/components/TeamCreation";

Enzyme.configure({ adapter: new Adapter() });

describe("TeamCreation form ", () => {
	describe("name input", () => {
		it("shows errors when left empty", () => {
			const view = mountWithIntl(<TeamCreation />);
			view.find("input").simulate("blur");
			expect(view.find("input").exists()).toBe(true);
		});
	});

	describe("submit button", () => {
		it("is disabled while the form is invalid", () => {
			const view = mountWithIntl(<TeamCreation />);
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is enabled while the form is valid", () => {
			const view = mountWithIntl(<TeamCreation />);
			view.find("input").simulate("change", { target: { value: "Foo Team" } });
			expect(view.find("Button").prop("disabled")).toBe(false);
		});
	});
});
