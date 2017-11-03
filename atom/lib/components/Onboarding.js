import React, { Component } from "react"
import onboardingFlow from "./onboardingFlow"
import SignupForm from "./SignupForm"
import EmailConfirmationForm from "./EmailConfirmationForm"

export default class Onboarding extends Component {
	constructor(props) {
		super(props)
		this.state = {
			current: onboardingFlow.initial,
			email: ""
		}
	}

	transition = (action, data) =>
		this.setState(state => ({ ...data, current: onboardingFlow.transition(state.current, action) }))

	render() {
		const views = {
			signUp: <SignupForm {...this.props} transition={this.transition} />,
			confirmEmail: <EmailConfirmationForm email={this.state.email} transition={this.transition} />,
			signIn: "Sign in here..."
		}
		return views[this.state.current]
	}
}
