import React, { Component } from "react"
import onboardingFlow from "./onboardingFlow"
import SignupForm from "./SignupForm"
import ConfirmEmail from "./ConfirmEmail"

export default class Onboarding extends Component {
	constructor(props) {
		super(props)
		this.state = {
			current: onboardingFlow.initial
		}
	}

	transition = action =>
		this.setState(state => ({ current: onboardingFlow.transition(state.current, action) }))

	render() {
		const views = {
			signUp: <SignupForm {...this.props} transition={this.transition} />,
			confirmEmail: <ConfirmEmail />,
			signIn: "Sign in here..."
		}
		return views[this.state.current]
	}
}
