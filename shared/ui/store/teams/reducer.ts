import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { State, TeamsActionsType } from "./types";

type TeamsActions = ActionType<typeof actions>;

const initialState: State = {};

export function reduceTeams(state = initialState, action: TeamsActions) {
	switch (action.type) {
		case TeamsActionsType.Bootstrap:
			return toMapBy("id", action.payload);
		case TeamsActionsType.Add:
			return { ...state, ...toMapBy("id", action.payload) };
		case "RESET":
			return initialState;
		default:
			return state;
	}
}
