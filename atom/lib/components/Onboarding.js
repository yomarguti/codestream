import React, { Component } from "react";
import { Machine } from "xstate";
import SignupForm from "./SignupForm";
import EmailConfirmationForm from "./EmailConfirmationForm";
import LoginForm from "./LoginForm";

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
				alreadyConfirmed: "login",
				back: "signUp"
			}
		},
		login: {
			on: {
				success: "chat",
				signUp: "signUp"
			}
		},
		chat: {}
	}
};

export default class Onboarding extends Component {
	flow = Machine(chart);

	constructor(props) {
		super(props);
		this.state = {
			currentStep: this.flow.getInitialState(),
			currentProps: this.props,
			email: ""
		};
	}

	transition = (action, data = {}) =>
		this.setState(state => {
			return {
				currentProps: data,
				currentStep: this.flow.transition(state.currentStep, action).toString()
			};
		});

	render() {
		const nextProps = { transition: this.transition, ...this.state.currentProps };
		const views = {
			signUp: <SignupForm {...nextProps} />,
			confirmEmail: <EmailConfirmationForm {...nextProps} />,
			login: <LoginForm {...nextProps} />,
			chat: "TODO: show chat",
			resetPassword: "TODO: reset password"
		};
		return views[this.state.currentStep];
	}
}
