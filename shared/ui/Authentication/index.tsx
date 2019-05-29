import React from "react";
import { connect } from "react-redux";
import { CodeStreamState } from "../store";
import { Login } from "./Login";
import { NewUserEntry } from "./NewUserEntry";
import { CodeStreamOrSlack } from "./CodeStreamOrSlack";
import { SlackAuth } from "./SlackAuth";
import { Signup } from "./Signup";
import { JoinTeam } from "./JoinTeam";
import { EmailConfirmation } from "./EmailConfirmation";
import { TeamCreation } from "./TeamCreation";
import { RouteState, Route } from "../store/context/types";

interface ConnectedProps extends RouteState {}

export const UnauthenticatedRoutes = connect<ConnectedProps, void, void, CodeStreamState>(
	state => state.context.route
)((props: ConnectedProps) => {
	switch (props.name) {
		case Route.NewUser: {
			return <NewUserEntry {...props.params} />;
		}
		case Route.CSOrSlack: {
			return <CodeStreamOrSlack {...props.params} />;
		}
		case Route.SlackAuth: {
			return <SlackAuth {...props.params} />;
		}
		case Route.Signup:
			return <Signup {...props.params} />;
		case Route.Login:
			return <Login {...props.params} />;
		case Route.JoinTeam:
			return <JoinTeam {...props.params} />;
		case Route.EmailConfirmation:
			return <EmailConfirmation {...props.params as any} />;
		case Route.TeamCreation:
			return <TeamCreation {...props.params} />;
		default:
			return <Login {...props.params} />;
	}
});
