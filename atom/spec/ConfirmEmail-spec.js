import React from "react"
import Enzyme, { mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import ConfirmEmail from "../lib/components/ConfirmEmail"

Enzyme.configure({ adapter: new Adapter() })

describe("ConfirmEmail view", () => {
	describe("input fields", () => {
		const view = mount(<ConfirmEmail />)

		it("they won't accept non-numerical values", () => {
			view
				.find("#inputs input")
				.forEach(input => input.simulate("change", { target: { value: "a" } }))
			view.find("#inputs input").forEach(input => {
				expect(input.prop("value")).toBe("")
			})
		})

		it("they will accept numerical values", () => {
			view
				.find("#inputs input")
				.forEach(input => input.simulate("change", { target: { value: "1" } }))
			view.find("#inputs input").forEach(input => {
				expect(input.prop("value")).toBe("1")
			})
		})
	})
})
