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
			expect(view.find('input[placeholder="Username"][required]').exists()).toBe(true)
		})

		// TODO
		xit("shows errors when there are invalid characters", () => {
			const event = { target: { value: "foobar\\" } }
			view.find('input[name="username"]').simulate("change", event)
			expect(view.find(".error-message").text()).toBe("message about characters")
		})
	})
})
