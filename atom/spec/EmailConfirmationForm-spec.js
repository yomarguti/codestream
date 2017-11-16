import React from "react";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { mountWithIntl } from "./intl-test-helper.js";
import EmailConfirmationForm, { Simple } from "../lib/components/EmailConfirmationForm";

Enzyme.configure({ adapter: new Adapter() });

describe("EmailConfirmationForm view", () => {
	describe("input fields", () => {
		const view = mountWithIntl(<EmailConfirmationForm />);

		it("they won't accept non-numerical values", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "a" } }));
			view.find("input").forEach(input => {
				expect(input.prop("value")).toBe("");
			});
		});

		it("they will accept numerical values", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
			view.find("input").forEach(input => {
				expect(input.prop("value")).toBe("1");
			});
		});
	});

	describe("'Change it' link", () => {
		it("routes back to the sign up form", () => {
			const transition = jasmine.createSpy();
			const view = mountWithIntl(<EmailConfirmationForm transition={transition} />);

			view.find("#go-back").simulate("click");

			expect(transition).toHaveBeenCalledWith("back");
		});
	});

	describe("Submit button", () => {
		const view = mountWithIntl(<EmailConfirmationForm />);

		it("is disabled while the form is empty", () => {
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is disabled while the form is invalid", () => {
			view.find("input").forEach((input, index) => {
				if (index < 3) input.simulate("change", { target: { value: "1" } });
			});
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is enabled when the form is valid", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
			expect(view.find("Button").prop("disabled")).toBe(false);
		});
	});

	describe("valid form submission", () => {
		it("sends the userId, email, and code", () => {
			const confirmEmail = jasmine.createSpy("confirm email stub function");
			confirmEmail.andReturn(Promise.resolve());
			const email = "foo@bar.com";
			const userId = "12345";
			const view = mountWithIntl(
				<EmailConfirmationForm confirmEmail={confirmEmail} email={email} _id={userId} />
			);
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
			view.find("form").simulate("submit");
			waitsFor(() => confirmEmail.callCount > 0);
			runs(() => expect(confirmEmail).toHaveBeenCalledWith({ email, userId, code: "111111" }));
		});
	});

	describe("when submitted code is invalid", () => {
		it("shows an error message", () => {
			const view = mountWithIntl(
				<EmailConfirmationForm
					confirmEmail={() => Promise.reject({ data: { code: "USRC-1002" } })}
				/>
			);
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
			view.find("form").simulate("submit");
			waitsFor(() => view.state("invalidCode"));
			runs(() => {
				view.update();
				expect(view.find(".error-message").text()).toBe("Uh oh. Invalid code.");
			});
		});

		describe("after 3 failed attempts", () => {
			it("sends them back to sign up page", () => {
				const transition = jasmine.createSpy("transition function");
				const view = mountWithIntl(
					<EmailConfirmationForm
						confirmEmail={() => Promise.reject({ data: { code: "USRC-1004" } })}
						transition={transition}
					/>
				);
				view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
				view.find("form").simulate("submit");
				waitsFor(() => transition.callCount > 0);
				runs(() => expect(transition).toHaveBeenCalledWith("back"));
			});
		});
	});

	describe("when the submitted code has expired", () => {
		it("shows an error message", () => {
			const view = mountWithIntl(
				<EmailConfirmationForm
					confirmEmail={() => Promise.reject({ data: { code: "USRC-1003" } })}
				/>
			);
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
			view.find("form").simulate("submit");
			waitsFor(() => view.state("expiredCode"));
			runs(() => {
				view.update();
				expect(view.find(".error-message").text()).toBe("Sorry, that code has expired.");
			});
		});
	});

	describe("when the user is already confirmed", () => {
		it("redirects them to the login form", () => {
			const transition = jasmine.createSpy("transition stub");
			const view = mountWithIntl(
				<EmailConfirmationForm
					transition={transition}
					confirmEmail={() => Promise.reject({ data: { code: "USRC-1006" } })}
				/>
			);
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }));
			view.find("form").simulate("submit");
			waitsFor(() => transition.callCount > 0);
			runs(() => expect(transition).toHaveBeenCalledWith("alreadyConfirmed"));
		});
	});
});
