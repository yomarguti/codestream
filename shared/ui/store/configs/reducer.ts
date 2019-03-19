import { ActionType } from "../common";
import * as actions from "./actions";
import { ConfigsActionsType, State } from "./types";

type ConfigsActions = ActionType<typeof actions>;

const initialState: State = {
	showHeadshots: true,
	debug: false,
	serverUrl: ""
};

export function reduceConfigs(state = initialState, { type, payload }: ConfigsActions) {
	switch (type) {
		case ConfigsActionsType.Update:
			return { ...state, ...payload };
		default:
			return { ...initialState, ...state };
	}
}
