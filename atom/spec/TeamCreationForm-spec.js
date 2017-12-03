import React from "react";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { mountWithIntl } from "./intl-test-helper.js";
import { SimpleTeamCreationForm } from "../lib/components/onboarding/TeamCreationForm";

Enzyme.configure({ adapter: new Adapter() });

describe("TeamCreationForm", () => {
	describe("name input", () => {
		it("shows errors when left empty", () => {
			const view = mountWithIntl(<SimpleTeamCreationForm />);
			view.find("input").simulate("blur");
			expect(view.find("input").exists()).toBe(true);
		});
	});

	describe("submit button", () => {
		it("is disabled while the form is invalid", () => {
			const view = mountWithIntl(<SimpleTeamCreationForm />);
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is enabled while the form is valid", () => {
			const view = mountWithIntl(<SimpleTeamCreationForm />);
			view.find("input").simulate("change", { target: { value: "Foo Team" } });
			expect(view.find("Button").prop("disabled")).toBe(false);
		});
	});

	describe("when the form is submitted", () => {
		it("calls the createTeam function", () => {
			const name = "Foo Team";
			const url = "foobar.com";
			const firstCommitHash = "123ba3";
			const team = { name };
			const store = { getState: () => ({ repoMetadata: { url, firstCommitHash } }) };
			const createTeam = jasmine.createSpy("createTeam stub").andReturn(Promise.resolve());
			const view = mountWithIntl(<SimpleTeamCreationForm createTeam={createTeam} store={store} />);

			view.find("input").simulate("change", { target: { value: name } });
			view.find("form").simulate("submit");

			waitsFor(() => createTeam.callCount > 0);
			runs(() => expect(createTeam).toHaveBeenCalledWith(name));
		});
	});
});
