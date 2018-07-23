import React from "react";
import { connect } from "react-redux";
import SignupForm from "./SignupForm";
import EmailConfirmationForm from "./EmailConfirmationForm";
import LoginForm from "./LoginForm";
import TeamCreationForm from "./TeamCreationForm";
import TeamSelectionForm from "./TeamSelectionForm";
import TeamMemberSelectionForm from "./TeamMemberSelectionForm";
import ChangeUsernameForm from "./ChangeUsernameForm";
import GetInvitedForm from "./GetInvitedForm";

const views = {
	signUp: SignupForm,
	confirmEmail: EmailConfirmationForm,
	login: LoginForm,
	createTeam: TeamCreationForm,
	selectTeam: TeamSelectionForm,
	getInvited: GetInvitedForm,
	identifyMembers: TeamMemberSelectionForm,
	changeUsername: ChangeUsernameForm
};

const mapStateToProps = ({ onboarding }) => ({ ...onboarding });

export default connect(mapStateToProps)(({ step, props }) => {
	return React.createElement(views[step], props);
});
