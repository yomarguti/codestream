import React from "react"
import Enzyme, { render, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import Onboarding from "../lib/components/Onboarding"

Enzyme.configure({ adapter: new Adapter() })

const mockRepository = { getConfigValue() {}, getWorkingDirectory() {} }

describe("Onboarding view", () => {
	it("has fields for username, password, and email address", () => {
		const view = render(<Onboarding repository={mockRepository} />)
		expect(view.find('input[placeholder="Username"]').length).toBe(1)
		expect(view.find('input[placeholder="Password"]').length).toBe(1)
		expect(view.find('input[placeholder="Email Address"]').length).toBe(1)
	})

	describe("Username field", () => {
		const systemUser = "tommy"
		const view = mount(<Onboarding repository={mockRepository} username={systemUser} />)

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
		const view = mount(<Onboarding repository={mockRepository} />)

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
		const email = "foo@bar.com"
		const view = mount(<Onboarding repository={mockRepository} email={email} />)

		it("shows errors when left empty", () => {
			view.find('input[name="email"]').simulate("blur")
			expect(view.find('input[name="email"][required]').exists()).toBe(true)
		})

		describe("when an email address has is provided", () => {
			it("is pre-populated with given email address", () => {
				expect(view.find('input[name="email"]').prop("value")).toBe(email)
			})
		})

		describe("when an email address is not provided", () => {
			it("uses 'Email Address' as the placeholder", () => {
				expect(view.find('input[name="email"]').prop("placeholder")).toBe("Email Address")
			})
		})
	})

	describe("Sign Up button", () => {
		const view = mount(<Onboarding repository={mockRepository} />)

		it("is disabled while the form values are invalid", () => {
			expect(view.find("#signup-button").prop("disabled")).toBe(true)
		})

		it("is clickable while the form values are valid", () => {
			view.find('input[name="username"]').simulate("change", { target: { value: "f_oo-b7a.r" } })
			view.find('input[name="password"]').simulate("change", { target: { value: "somePassword" } })
			view.find('input[name="email"]').simulate("change", { target: { value: "foo@bar.com" } })

			expect(view.find("#signup-button").prop("disabled")).toBe(false)
		})
	})
})
