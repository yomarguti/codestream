import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { ReposActionsType, State } from "./types";

type ReposActions = ActionType<typeof actions>;

const initialState: State = {};

export function reduceRepos(state = initialState, { type, payload }: ReposActions) {
	switch (type) {
		case ReposActionsType.Bootstrap:
			return toMapBy("id", payload);
		case ReposActionsType.Add:
			return { ...state, ...toMapBy("id", payload) };
		default:
			return state;
	}
}

export const getById = (state, id) => {
	return state[id];
};
