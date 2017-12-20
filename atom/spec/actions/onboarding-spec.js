import sinon from "sinon";
import * as http from "../../lib/network-request";
import * as actions from "../../lib/actions/onboarding";

describe("onboarding action creators", () => {
	describe("confirmEmail", () => {
		describe("when the confirmed user is not a member of the team for the current repo", () => {
			afterEach(() => {
				http.post.restore();
			});

			it("adds them to team", () => {
				const email = "foo@bar.com";
				sinon
					.stub(http, "post")
					.returns(Promise.resolve({ accessToken: "", user: { email }, teams: [], repos: [] }));
				// sinon.stub(actions, "addMembers").returns(Promise.resolve());
				const dispatch = jasmine.createSpy("spy for dispatch");

				waitsForPromise(async () => {
					await actions.confirmEmail({ email })(dispatch, () => ({
						context: { currentTeamId: "1" }
					}));
					// expect(actions.addMembers.calledWith([email])).toBe(true);
					expect(dispatch).toHaveBeenCalledWith({ type: "EXISTING_USER_CONFIRMED" });
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

				actions.authenticate()(dispatch, () => ({ context: { currentTeamId: "1" } }));

				waitsFor(() => dispatch.callCount > 3);
				runs(() => {
					expect(dispatch).toHaveBeenCalledWith({ type: "LOGGED_INTO_FOREIGN_REPO" });
				});
			});
		});
	});
});
