import React from "react";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { mountWithIntl } from "./intl-test-helper.js";
import { SimpleTeamCreationForm as TeamCreationForm } from "../lib/components/onboarding/TeamCreationForm";

Enzyme.configure({ adapter: new Adapter() });

describe("TeamCreationForm", () => {
	describe("name input", () => {
		it("shows errors when left empty", () => {
			const view = mountWithIntl(<TeamCreationForm />);
			view.find("input").simulate("blur");
			expect(view.find("input").exists()).toBe(true);
		});
	});

	describe("submit button", () => {
		it("is disabled while the form is invalid", () => {
			const view = mountWithIntl(<TeamCreationForm />);
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is enabled while the form is valid", () => {
			const view = mountWithIntl(<TeamCreationForm />);
			view.find("input").simulate("change", { target: { value: "Foo Team" } });
			expect(view.find("Button").prop("disabled")).toBe(false);
		});
	});

	describe("when the form is submitted", () => {
		it("sends the repo url, first commit hash, and team name", () => {
			const name = "Foo Team";
			const url = "foobar.com";
			const firstCommitHash = "123ba3";
			const team = { name };
			const store = { getState: () => ({ repoMetadata: { url, firstCommitHash } }) };
			const createTeam = jasmine.createSpy("createTeam stub").andReturn(Promise.resolve());
			const view = mountWithIntl(<TeamCreationForm createTeam={createTeam} store={store} />);

			view.find("input").simulate("change", { target: { value: name } });
			view.find("form").simulate("submit");

			waitsFor(() => createTeam.callCount > 0);
			runs(() => expect(createTeam).toHaveBeenCalledWith({ url, firstCommitHash, name }));
		});

		describe("when the server responds with 200", () => {
			it("redirects to team member selection", () => {
				const name = "Foo Team";
				const url = "foobar.com";
				const firstCommitHash = "123ba3";
				const team = { name };
				const store = { getState: () => ({ repoMetadata: { url, firstCommitHash } }) };
				const createTeam = jasmine
					.createSpy("createTeam stub")
					.andReturn(Promise.resolve({ team: { _id: "teamId" } }));
				const transition = jasmine.createSpy("transition stub");
				const view = mountWithIntl(
					<TeamCreationForm createTeam={createTeam} transition={transition} store={store} />
				);

				view.find("input").simulate("change", { target: { value: name } });
				view.find("form").simulate("submit");

				waitsFor(() => transition.callCount > 0);
				runs(() => expect(transition).toHaveBeenCalledWith("success", { teamId: "teamId" }));
			});
		});
	});
});
