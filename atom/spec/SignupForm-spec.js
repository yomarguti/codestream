import React from "react"
import Enzyme, { render, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import SignupForm from "../lib/components/SignupForm"

Enzyme.configure({ adapter: new Adapter() })

const mockRepository = { getConfigValue() {}, getWorkingDirectory() {} }

describe("SignupForm view", () => {
	it("has fields for username, password, and email address", () => {
		const view = render(<SignupForm repository={mockRepository} />)
		expect(view.find('input[name="username"]').length).toBe(1)
		expect(view.find('input[name="password"]').length).toBe(1)
		expect(view.find('input[name="email"]').length).toBe(1)
	})

	describe("Username field", () => {
		const systemUser = "tommy"
		const view = mount(<SignupForm repository={mockRepository} username={systemUser} />)

		describe("when a username is provided", () => {
			it("is pre-populated with given username", () => {
				expect(view.find('input[name="username"]').prop("value")).toBe(systemUser)
			})
		})

		describe("when a username is not provided", () => {
			it("uses 'Username' as the placeholder", () => {
				expect(view.find('input[name="username"]').prop("placeholder")).toBe("Username")
			})
		})

		it("shows errors when left empty", () => {
			view.find('input[name="username"]').simulate("blur")
			expect(view.find('input[name="username"][required]').exists()).toBe(true)
		})

		it("shows errors when there are invalid characters", () => {
			const event = { target: { value: "foobar\\?^$" } }
			view.find('input[name="username"]').simulate("change", event)
			expect(view.find("#username-controls .error-message").text()).toContain("characters")
		})
	})

	describe("Password field", () => {
		const view = mount(<SignupForm repository={mockRepository} />)

		it("shows errors when left empty", () => {
			view.find('input[name="password"]').simulate("blur")
			expect(view.find('input[name="password"][required]').exists()).toBe(true)
		})

		it("shows message when value is not long enough", () => {
			view.find('input[name="password"]').simulate("blur")
			view.find('input[name="password"]').simulate("change", { target: { value: "four" } })
			expect(view.find("#password-controls .error-message").text()).toBe(
				"2 more character(s) please"
			)
		})
	})

	describe("Email address field", () => {
		const view = mount(<SignupForm repository={mockRepository} />)

		it("shows errors when left empty", () => {
			view.find('input[name="email"]').simulate("blur")
			expect(view.find('input[name="email"][required]').exists()).toBe(true)
		})

		it("shows errors when provided input is invalid", () => {
			view.find('input[name="email"]').simulate("change", { target: { value: "foo@" } })
			expect(view.find("#email-controls .error-message").text()).toBe(
				"Looks like an invalid email address!"
			)
		})

		describe("when an email address is not provided", () => {
			it("uses 'Email Address' as the placeholder", () => {
				expect(view.find('input[name="email"]').prop("placeholder")).toBe("Email Address")
			})
		})

		describe("when an email address is provided to the component", () => {
			const email = "foo@bar.com"
			const view = mount(<SignupForm repository={mockRepository} email={email} />)
			it("is pre-populated with given email address", () => {
				expect(view.find('input[name="email"]').prop("value")).toBe(email)
			})
		})
	})

	describe("Sign Up button", () => {
		const view = mount(<SignupForm repository={mockRepository} />)

		it("is disabled while the form values are invalid", () => {
			expect(view.find("Button").prop("disabled")).toBe(true)
		})

		it("is clickable while the form values are valid", () => {
			view.find('input[name="username"]').simulate("change", { target: { value: "f_oo-b7a.r" } })
			view.find('input[name="password"]').simulate("change", { target: { value: "somePassword" } })
			view.find('input[name="email"]').simulate("change", { target: { value: "foo@bar.com" } })

			expect(view.find("Button").prop("disabled")).toBe(false)
		})
	})

	describe("when valid credentials are submitted", () => {
		describe("when the email already exists", () => {
			it("the user is taken to the login page", () => {
				const email = "foo@bar.com"
				const createUser = () => Promise.reject({ emailExists: true })
				const transition = jasmine.createSpy("transition function")
				const view = mount(
					<SignupForm repository={mockRepository} createUser={createUser} transition={transition} />
				)
				view.find('input[name="username"]').simulate("change", { target: { value: "f_oo-b7a.r" } })
				view
					.find('input[name="password"]')
					.simulate("change", { target: { value: "somePassword" } })
				view.find('input[name="email"]').simulate("change", { target: { value: email } })

				view.find("form").simulate("submit")
				waitsFor(() => transition.callCount > 0)
				runs(() => expect(transition).toHaveBeenCalledWith("emailExists", { email }))
			})
		})
	})
})
