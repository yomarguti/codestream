import sinon from "sinon";
import db from "../../lib/local-cache";
import * as http from "../../lib/network-request";
import { confirmEmail, authenticate } from "../../lib/actions/onboarding";

describe("onboarding action creators", () => {
	describe("confirmEmail", () => {
		describe("when the confirmed user is not a member of the team for the current repo", () => {
			afterEach(() => http.post.restore());

			it("dispatches a no access action", () => {
				sinon
					.stub(http, "post")
					.returns(Promise.resolve({ accessToken: "", user: {}, teams: [], repos: [] }));
				const dispatch = jasmine.createSpy("spy for dispatch");

				confirmEmail()(dispatch, () => ({ context: { currentTeamId: "1" } }));

				waitsFor(() => dispatch.callCount > 3);
				runs(() => {
					expect(dispatch).toHaveBeenCalledWith({
						type: "EXISTING_USER_CONFIRMED_IN_FOREIGN_REPO"
					});
				});
			});
		});
	});

	describe("authenticate", () => {
		describe("when the authenticated user is not a member of the team for the current repo", () => {
			afterEach(() => http.put.restore());

			it("dispatches a no access action", () => {
				sinon
					.stub(http, "put")
					.returns(
						Promise.resolve({ accessToken: "", user: {}, teams: [{ _id: "teamId4" }], repos: [] })
					);
				const dispatch = jasmine.createSpy("spy for dispatch");

				authenticate()(dispatch, () => ({ context: { currentTeamId: "1" } }));

				waitsFor(() => dispatch.callCount > 3);
				runs(() => {
					expect(dispatch).toHaveBeenCalledWith({ type: "LOGGED_INTO_FOREIGN_REPO" });
				});
			});
		});
	});
});
