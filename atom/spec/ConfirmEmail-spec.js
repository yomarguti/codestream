import React from "react"
import Enzyme, { mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import ConfirmEmail from "../lib/components/ConfirmEmail"

Enzyme.configure({ adapter: new Adapter() })

describe("ConfirmEmail view", () => {
	describe("input fields", () => {
		const view = mount(<ConfirmEmail />)

		it("they won't accept non-numerical values", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "a" } }))
			view.find("input").forEach(input => {
				expect(input.prop("value")).toBe("")
			})
		})

		it("they will accept numerical values", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
			view.find("input").forEach(input => {
				expect(input.prop("value")).toBe("1")
			})
		})
	})

	describe("'Change it' link", () => {
		it("routes back to the sign up form", () => {
			const transition = jasmine.createSpy()
			const view = mount(<ConfirmEmail transition={transition} />)

			view.find("#go-back").simulate("click")

			expect(transition).toHaveBeenCalledWith("back")
		})
	})

	describe("Submit button", () => {
		const view = mount(<ConfirmEmail />)

		it("is disabled while the form is empty", () => {
			expect(view.find("#submit-button").prop("disabled")).toBe(true)
		})

		it("is disabled while the form is invalid", () => {
			view.find("input").forEach((input, index) => {
				if (index < 3) input.simulate("change", { target: { value: "1" } })
			})
			expect(view.find("#submit-button").prop("disabled")).toBe(true)
		})

		it("is enabled when the form is valid", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
			expect(view.find("#submit-button").prop("disabled")).toBe(false)
		})
	})

	describe("when submitted code is invalid", () => {
		it("shows an error", () => {
			const view = mount(<ConfirmEmail confirmEmail={() => Promise.reject()} />)
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
			view.find("#submit-button").simulate("click")
			waitsFor(() => view.state("invalidCode"))
			runs(() => {
				view.update()
				expect(view.find(".error-message").text()).toBe("Uh oh. Invalid code.")
			})
		})

		describe("after 3 failed attempts", () => {
			it("sends them back to sign up page", () => {
				const transition = jasmine.createSpy("transition function")
				const view = mount(
					<ConfirmEmail confirmEmail={() => Promise.reject()} transition={transition} />
				)
				view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
				view.find("#submit-button").simulate("click")
				waitsFor(() => view.state("failCount") === 1)
				runs(() => {
					view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
					view.find("#submit-button").simulate("click")
				})
				waitsFor(() => view.state("failCount") === 2)
				runs(() => {
					view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
					view.find("#submit-button").simulate("click")
				})
				waitsFor(() => transition.callCount > 0)
				runs(() => expect(transition).toHaveBeenCalledWith("back"))
			})
		})
	})
})
