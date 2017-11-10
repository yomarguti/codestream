import React, { Component } from "react"
import { Machine } from "xstate"
import SignupForm from "./SignupForm"
import EmailConfirmationForm from "./EmailConfirmationForm"
import LoginForm from "./LoginForm"

const chart = {
	key: "onboarding",
	initial: "signUp",
	states: {
		signUp: {
			on: {
				success: "confirmEmail",
				emailExists: "login",
				alreadySignedUp: "login"
			}
		},
		confirmEmail: {
			on: {
				success: "login",
				back: "signUp"
			}
		},
		login: {
			on: {
				success: "chat",
				signUp: "signUp",
				forgotPassword: "resetPassword"
			}
		},
		chat: {},
		resetPassword: {}
	}
}

export default class Onboarding extends Component {
	flow = Machine(chart)

	constructor(props) {
		super(props)
		this.state = {
			currentStep: this.flow.getInitialState(),
			email: ""
		}
	}

	transition = (action, data = {}) =>
		this.setState(state => {
			return {
				...data,
				currentStep: this.flow.transition(state.currentStep, action).toString()
			}
		})

	render() {
		const views = {
			signUp: <SignupForm {...this.props} transition={this.transition} />,
			confirmEmail: <EmailConfirmationForm email={this.state.email} transition={this.transition} />,
			login: (
				<LoginForm
					email={this.state.email}
					alreadySignedUp={this.state.alreadySignedUp}
					transition={this.transition}
				/>
			),
			chat: "TODO: show chat",
			resetPassword: "TODO: reset password"
		}
		return views[this.state.currentStep]
	}
}
