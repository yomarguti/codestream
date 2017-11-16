import React from "react";
import Enzyme, { render } from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { mountWithIntl } from "./intl-test-helper.js";
import LoginForm from "../lib/components/LoginForm";

Enzyme.configure({ adapter: new Adapter() });

const mockRepository = { getConfigValue() {}, getWorkingDirectory() {} };

describe("LoginForm", () => {
	describe("Email address field", () => {
		const view = mountWithIntl(<LoginForm />);

		it("shows errors when left empty", () => {
			view.find('input[name="email"]').simulate("blur");
			expect(view.find('input[name="email"][required]').exists()).toBe(true);
		});

		it("shows errors when provided input is invalid", () => {
			view.find('input[name="email"]').simulate("change", { target: { value: "foo@" } });
			expect(view.find("#email-controls .error-message").text()).toBe(
				"Looks like an invalid email address!"
			);
		});

		describe("when an email address is not provided", () => {
			it("uses 'Email Address' as the placeholder", () => {
				expect(view.find('input[name="email"]').prop("placeholder")).toBe("Email Address");
			});
		});

		describe("when 'email' and 'alreadySignedUp' props are provided to the component", () => {
			const email = "foo@baz.com";
			const view = mountWithIntl(<LoginForm email={email} alreadySignedUp={true} />);
			it("is pre-populated with given email address", () => {
				expect(view.find('input[name="email"]').prop("value")).toBe(email);
			});

			it("there is a message about the user being already signed up", () => {
				expect(view.text()).toContain(
					"Looks like you're already signed up! Please enter your password."
				);
			});
		});
	});

	describe("Password field", () => {
		it("shows errors when left empty", () => {
			const view = mountWithIntl(<LoginForm />);
			view.find('input[name="password"]').simulate("blur");
			expect(view.find('input[name="password"][required]').exists()).toBe(true);
		});
	});

	describe("Sign In button", () => {
		const view = mountWithIntl(<LoginForm />);

		it("is disabled while the form values are invalid", () => {
			expect(view.find("Button").prop("disabled")).toBe(true);
		});

		it("is clickable while the form values are valid", () => {
			view.find('input[name="email"]').simulate("change", { target: { value: "foo@bar.com" } });
			view.find('input[name="password"]').simulate("change", { target: { value: "somePassword" } });

			expect(view.find("Button").prop("disabled")).toBe(false);
		});
	});

	describe("when valid credentials are submitted", () => {
		describe("when authentication fails", () => {
			it("shows an error", () => {
				const email = "foo@bar.com";
				const authenticate = () => Promise.reject();
				const view = mountWithIntl(<LoginForm authenticate={authenticate} />);
				view.find('input[name="email"]').simulate("change", { target: { value: email } });
				view
					.find('input[name="password"]')
					.simulate("change", { target: { value: "somePassword" } });
				view.find("form").simulate("submit");

				waitsFor(() => view.state("failed"));
				runs(() => {
					view.update();
					expect(view.find(".form-error").text()).toBe(
						"Sorry, you entered an incorrect email or password."
					);
				});
			});
		});
	});
});
