import React from "react";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { mountWithIntl } from "./intl-test-helper.js";
import { SimpleTeamSelectionForm as TeamSelectionForm } from "../lib/components/TeamSelectionForm";

Enzyme.configure({ adapter: new Adapter() });

const firstCommitHash = "123ab";
const repoUrl = "https:repo.com/mine.git";
const transition = jasmine.createSpy("transition stub");

const mockStore = {
	getState() {
		return {
			teams: [{ _id: 1, name: "The Foobars" }, { _id: 2, name: "Cool Coders" }],
			repoMetadata: {
				url: repoUrl,
				firstCommitHash
			}
		};
	}
};
describe("TeamSelectionForm", () => {
	it("has radio inputs for each of the user's teams and one for creating a new team", () => {
		const view = mountWithIntl(<TeamSelectionForm store={mockStore} />);
		expect(view.find('input[type="radio"]').length).toBe(3);
	});

	describe("when the 'Create new team' option is selected", () => {
		it("shows errors when the text field is left empty", () => {
			const view = mountWithIntl(<TeamSelectionForm store={mockStore} />);
			view
				.find('input[value="createTeam"]')
				.simulate("change", { target: { value: "createTeam" } });
			view.find("#name-input").simulate("blur");
			expect(view.find("#name-input").prop("required")).toBe(true);
		});
	});

	describe("submit button", () => {
		it("is disabled while the form is invalid", () => {
			const view = mountWithIntl(<TeamSelectionForm store={mockStore} />);
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is enabled while the form is valid", () => {
			const view = mountWithIntl(<TeamSelectionForm store={mockStore} />);
			view
				.find('input[type="radio"]')
				.at(1)
				.simulate("change", { target: { value: "1" } });
			expect(view.find("Button").prop("disabled")).toBe(false);
		});
	});

	describe("when the form is submitted", () => {
		describe("when the user selects an existing team", () => {
			it("sends the repo url, first commit hash, team id", () => {
				const createTeam = jasmine.createSpy("createTeam stub").andReturn(Promise.resolve());
				const view = mountWithIntl(
					<TeamSelectionForm createTeam={createTeam} store={mockStore} transition={transition} />
				);

				view
					.find('input[type="radio"]')
					.at(1)
					.simulate("change", { target: { value: "1" } });

				view.find("form").simulate("submit");

				waitsFor(() => createTeam.callCount > 0);
				runs(() =>
					expect(createTeam).toHaveBeenCalledWith({
						url: repoUrl,
						firstCommitHash,
						teamId: "1"
					})
				);
			});

			describe("server errors", () => {
				describe("when the team does not exist", () => {
					it("shows an error", () => {
						const createTeam = jasmine
							.createSpy("createTeam stub")
							.andReturn(Promise.reject({ data: { code: "RAPI-1003" } }));
						const view = mountWithIntl(
							<TeamSelectionForm
								createTeam={createTeam}
								store={mockStore}
								transition={transition}
							/>
						);

						view
							.find('input[type="radio"]')
							.at(1)
							.simulate("change", { target: { value: "1" } });

						view.find("form").simulate("submit");

						waitsFor(() => view.state("teamNotFound"));
						runs(() => {
							view.update();
							expect(view.find(".error-message").text()).toBe("The selected team doesn't exist.");
						});
					});
				});

				describe("when the user is not on the selected team", () => {
					it("shows an error", () => {
						const createTeam = jasmine
							.createSpy("createTeam stub")
							.andReturn(Promise.reject({ data: { code: "RAPI-1011" } }));
						const view = mountWithIntl(
							<TeamSelectionForm
								createTeam={createTeam}
								store={mockStore}
								transition={transition}
							/>
						);

						view
							.find('input[type="radio"]')
							.at(1)
							.simulate("change", { target: { value: "1" } });

						view.find("form").simulate("submit");

						waitsFor(() => view.state("noPermission"));
						runs(() => {
							view.update();
							expect(view.find(".error-message").text()).toBe(
								"You are not a member of the selected team."
							);
						});
					});
				});
			});
		});

		describe("when the user is creating a new team", () => {
			it("sends the repo url, first commit hash, and team name", () => {
				const createTeam = jasmine.createSpy("createTeam stub").andReturn(Promise.resolve());
				const view = mountWithIntl(
					<TeamSelectionForm createTeam={createTeam} store={mockStore} transition={transition} />
				);
				const newTeamName = "Bar Baz";

				view.find("#name-input").simulate("change", { target: { value: newTeamName } });
				view.find("form").simulate("submit");

				waitsFor(() => createTeam.callCount > 0);
				runs(() =>
					expect(createTeam).toHaveBeenCalledWith({
						url: repoUrl,
						firstCommitHash,
						name: newTeamName
					})
				);
			});
		});
	});
});
