import React, { Component } from "react";
import { Machine } from "xstate";
import { connect } from "redux-zero/react";
import SignupForm from "./SignupForm";
import EmailConfirmationForm from "./EmailConfirmationForm";
import LoginForm from "./LoginForm";
import TeamCreationForm from "./TeamCreationForm";
import TeamSelectionForm from "./TeamSelectionForm";
import TeamMemberSelectionForm from "./TeamMemberSelectionForm";

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
				selectTeamForRepo: "selectTeam",
				newTeamForRepo: "createTeam",
				alreadyConfirmed: "login",
				confirmedNewMember: "complete",
				back: "signUp"
			}
		},
		login: {
			on: {
				success: "complete",
				signUp: "signUp"
			}
		},
		createTeam: {
			on: {
				success: "identifyMembers"
			}
		},
		selectTeam: {
			on: {
				success: "identifyMembers"
			}
		},
		identifyMembers: {
			on: {
				success: "complete"
			}
		},
		complete: {}
	}
};

class Onboarding extends Component {
	flow = Machine(chart);

	constructor(props) {
		super(props);
		this.state = {
			currentStep: props.currentStep || this.flow.getInitialState(),
			currentProps: props.currentProps || props
		};
	}

	transition = (action, data = {}) => {
		const { updateOnboarding } = this.props;
		const nextStep = this.flow.transition(this.state.currentStep, action).toString();
		if (nextStep === "complete") {
			updateOnboarding(undefined);
			this.props.onComplete();
		} else {
			const nextState = {
				currentProps: data,
				currentStep: nextStep
			};
			updateOnboarding(nextState);
			this.setState(nextState);
		}
	};

	render() {
		const nextProps = { transition: this.transition, ...this.state.currentProps };
		const views = {
			signUp: <SignupForm {...nextProps} />,
			confirmEmail: <EmailConfirmationForm {...nextProps} />,
			login: <LoginForm {...nextProps} />,
			createTeam: <TeamCreationForm {...nextProps} />,
			selectTeam: <TeamSelectionForm {...nextProps} />,
			identifyMembers: <TeamMemberSelectionForm {...nextProps} />
		};
		return views[this.state.currentStep];
	}
}

const mapStateToProps = ({ onboarding }) => ({ ...onboarding });
const actions = {
	updateOnboarding(state, onboarding) {
		return { onboarding };
	}
};
export default connect(mapStateToProps, actions)(Onboarding);
