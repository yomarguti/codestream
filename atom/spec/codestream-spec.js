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
		const view = mount(<Onboarding repository={mockRepository} />)

		it("shows errors when left empty", () => {
			view.find('input[placeholder="Username"]').simulate("blur")
			expect(view.find('input[placeholder="Username"][required]').exists()).toBe(true)
		})
	})
})
