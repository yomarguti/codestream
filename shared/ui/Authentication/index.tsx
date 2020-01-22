import React from "react";
import { useSelector } from "react-redux";
import { CodeStreamState } from "../store";
import { Login } from "./Login";
import { NewUserEntry } from "./NewUserEntry";
import { SlackAuth } from "./SlackAuth";
import { MSTeamsAuth } from "./MSTeamsAuth";
import { Signup } from "./Signup";
import { JoinTeam } from "./JoinTeam";
import { EmailConfirmation } from "./EmailConfirmation";
import { TeamCreation } from "./TeamCreation";
import { Route } from "../store/context/types";
import { ForgotPassword } from "./ForgotPassword";
import { MSTeamsAdminApprovalInfo } from "./MSTeamsAdminApprovalInfo";
import { MustSetPassword } from "./MustSetPassword";

export const UnauthenticatedRoutes = () => {
	const props = useSelector((state: CodeStreamState) => state.context.route);

	switch (props.name) {
		case Route.NewUser:
			return <NewUserEntry {...props.params} />;
		case Route.SlackAuth:
			return <SlackAuth {...props.params} />;
		case Route.MSTeamsAdminApprovalInfo:
			return <MSTeamsAdminApprovalInfo {...props.params} />;
		case Route.MSTeamsAuth:
			return <MSTeamsAuth {...props.params} />;
		case Route.Signup:
			return <Signup {...props.params} />;
		case Route.Login:
			return <Login {...props.params} />;
		case Route.JoinTeam:
			return <JoinTeam {...props.params} />;
		case Route.EmailConfirmation:
			return <EmailConfirmation {...(props.params as any)} />;
		case Route.TeamCreation:
			return <TeamCreation {...props.params} />;
		case Route.ForgotPassword:
			return <ForgotPassword {...props.params} />;
		case Route.MustSetPassword:
			return <MustSetPassword {...(props.params as any)} />;
		default:
			return <Login {...props.params} />;
	}
};
