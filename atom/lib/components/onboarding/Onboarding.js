import React from "react";
import { connect } from "react-redux";
import SignupForm from "./SignupForm";
import EmailConfirmationForm from "./EmailConfirmationForm";
import LoginForm from "./LoginForm";
import TeamCreationForm from "./TeamCreationForm";
import TeamSelectionForm from "./TeamSelectionForm";
import TeamMemberSelectionForm from "./TeamMemberSelectionForm";
import ChangeUsernameForm from "./ChangeUsernameForm";

const mapStateToProps = ({ onboarding }) => ({ ...onboarding });

export default connect(mapStateToProps)(({ step, props, configs }) => {
	const nextProps = { configs, ...props };
	const views = {
		signUp: <SignupForm {...nextProps} />,
		confirmEmail: <EmailConfirmationForm {...nextProps} />,
		login: <LoginForm {...nextProps} />,
		createTeam: <TeamCreationForm {...nextProps} />,
		selectTeam: <TeamSelectionForm {...nextProps} />,
		identifyMembers: <TeamMemberSelectionForm {...nextProps} />,
		changeUsername: <ChangeUsernameForm {...nextProps} />
	};
	return views[step];
});
