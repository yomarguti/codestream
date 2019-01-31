import { ActionType } from "../common";
import * as actions from "./actions";
import { RouteActionsType, State } from "./types";

type RouteActions = ActionType<typeof actions>;

const initialState = {
	route: "signup",
	params: {}
};

export function reduceRoute(state: State = initialState, action: RouteActions) {
	switch (action.type) {
		case RouteActionsType.CompleteSignup:
			return { ...state, route: "completeSignup", params: action.payload };
		case RouteActionsType.Signup:
			return { ...state, route: "signup", params: action.payload };
		case RouteActionsType.Login:
			return { ...state, route: "login", params: action.payload };
		case RouteActionsType.SlackInfo:
			return { ...state, route: "slackInfo", params: {} };
		case "RESET":
			return { route: "login", params: {} };
		default:
			return state;
	}
}
