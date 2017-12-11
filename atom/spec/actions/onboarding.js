import { confirmEmail } from "../../lib/actions/onboarding";

describe("onboarding action creators", () => {
	describe("confirmEmail", () => {
		describe("when the confirmed user is not a member of the team for the current repo", () => {
			it("dispatches a no access action", () => {
				const dispatch = jasmine.createSpy("spy for dispatch");
				confirmEmail()(dispatch);
			});
		});
	});
});
