import React, { Component } from "react";
import { connect } from "redux-zero/react";
import getSystemUser from "username";
import NoGit from "./NoGit";
import Onboarding from "./Onboarding";
import Chat from "./Chat";

const onboardingChart = {
	initial: "signUp",
	on: {
		complete: "chat"
	},
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
		createTeam: {}
	}
};

const codestreamChart = {
	key: "codestream",
	initial: "onboarding",
	states: {
		onboarding: onboardingChart,
		chat: {}
	}
};

class CodeStreamRoot extends Component {
	static defaultProps = {
		repositories: [],
		user: {},
		team: {}
	};

	constructor(props) {
		super(props);
		this.state = {};
	}

	render() {
		const { user, repositories, team } = this.props;

		if (repositories.length === 0) return <NoGit />;
		else if (user.onboarded) return <Chat />;
		else {
			const repository = repositories[0];
			const gitDirectory = repository.getWorkingDirectory();
			const email = repository.getConfigValue("user.email", gitDirectory);
			const name = repository.getConfigValue("user.name", gitDirectory);
			return (
				<Onboarding
					team={team}
					email={email}
					username={getSystemUser.sync()}
					name={name}
					onComplete={this.props.completeOnboarding}
				/>
			);
		}
	}
}

const mapStateToProps = ({ user, team }) => ({ user, team });
const actions = store => ({
	completeOnboarding: state => ({ user: { ...state.user, onboarded: true } })
});
export default connect(mapStateToProps, actions)(CodeStreamRoot);
