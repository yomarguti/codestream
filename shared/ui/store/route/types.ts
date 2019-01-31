export interface State {
	route: string;
	params: { [key: string]: any };
}

export enum RouteActionsType {
	CompleteSignup = "GO_TO_COMPLETE_SIGNUP",
	Signup = "GO_TO_SIGNUP",
	Login = "GO_TO_LOGIN",
	SlackInfo = "GO_TO_SLACK_INFO"
}
