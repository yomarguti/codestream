import React from "react"
import Enzyme, { mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import EmailConfirmationForm from "../lib/components/EmailConfirmationForm"

Enzyme.configure({ adapter: new Adapter() })

describe("EmailConfirmationForm view", () => {
	describe("input fields", () => {
		const view = mount(<EmailConfirmationForm />)

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
			const view = mount(<EmailConfirmationForm transition={transition} />)

			view.find("#go-back").simulate("click")

			expect(transition).toHaveBeenCalledWith("back")
		})
	})

	describe("Submit button", () => {
		const view = mount(<EmailConfirmationForm />)

		it("is disabled while the form is empty", () => {
			expect(view.find("Button").prop("disabled")).toBe(true)
		})

		it("is disabled while the form is invalid", () => {
			view.find("input").forEach((input, index) => {
				if (index < 3) input.simulate("change", { target: { value: "1" } })
			})
			expect(view.find("Button").prop("disabled")).toBe(true)
		})

		it("is enabled when the form is valid", () => {
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
			expect(view.find("Button").prop("disabled")).toBe(false)
		})
	})

	describe("when submitted code is invalid", () => {
		it("shows an error message", () => {
			const view = mount(
				<EmailConfirmationForm confirmEmail={() => Promise.reject({ invalidCode: true })} />
			)
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
			view.find("form").simulate("submit")
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
					<EmailConfirmationForm
						confirmEmail={() => Promise.reject({ invalidCode: true })}
						transition={transition}
					/>
				)
				view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
				view.find("form").simulate("submit")
				waitsFor(() => view.state("failCount") === 1)
				runs(() => {
					view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
					view.find("form").simulate("submit")
				})
				waitsFor(() => view.state("failCount") === 2)
				runs(() => {
					view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
					view.find("form").simulate("submit")
				})
				waitsFor(() => transition.callCount > 0)
				runs(() => expect(transition).toHaveBeenCalledWith("back"))
			})
		})
	})

	describe("when the submitted code has expired", () => {
		it("shows an error message", () => {
			const view = mount(
				<EmailConfirmationForm confirmEmail={() => Promise.reject({ expiredCode: true })} />
			)
			view.find("input").forEach(input => input.simulate("change", { target: { value: "1" } }))
			view.find("form").simulate("submit")
			waitsFor(() => view.state("expiredCode"))
			runs(() => {
				view.update()
				expect(view.find(".error-message").text()).toBe("Sorry, that code has expired.")
			})
		})
	})
})
