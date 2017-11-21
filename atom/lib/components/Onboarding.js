import React, { Component } from "react";
import { Machine } from "xstate";
import SignupForm from "./SignupForm";
import EmailConfirmationForm from "./EmailConfirmationForm";
import LoginForm from "./LoginForm";
import TeamCreation from "./TeamCreation";

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
				confirmedNewMember: "complete",
				confirmedFirstMember: "createTeam",
				alreadyConfirmed: "login",
				back: "signUp"
			}
		},
		login: {
			on: {
				success: "complete",
				signUp: "signUp"
			}
		},
		complete: {},
		createTeam: {}
	}
};

export default class Onboarding extends Component {
	flow = Machine(chart);

	constructor(props) {
		super(props);
		this.state = {
			currentStep: this.flow.getInitialState(),
			currentProps: this.props
		};
	}

	transition = (action, data = {}) => {
		const nextStep = this.flow.transition(this.state.currentStep, action).toString();
		if (nextStep === "complete") this.props.onComplete();
		else
			this.setState(state => {
				return {
					currentProps: data,
					currentStep: nextStep
				};
			});
	};

	render() {
		const nextProps = { transition: this.transition, ...this.state.currentProps };
		const views = {
			signUp: <SignupForm {...nextProps} />,
			confirmEmail: <EmailConfirmationForm {...nextProps} />,
			login: <LoginForm {...nextProps} />,
			createTeam: <TeamCreation {...nextProps} />
		};
		return views[this.state.currentStep];
	}
}
