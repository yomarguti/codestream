import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { State, TeamsActionsType } from "./types";

type TeamsActions = ActionType<typeof actions>;

const initialState: State = {};

export function reduceTeams(state = initialState, { type, payload }: TeamsActions) {
	switch (type) {
		case TeamsActionsType.Bootstrap:
			return toMapBy("id", payload);
		case TeamsActionsType.Add:
			return { ...state, ...toMapBy("id", payload) };
		default:
			return state;
	}
}
