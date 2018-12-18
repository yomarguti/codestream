import { ActionType } from "../common";
import * as actions from "./actions";
import { ConnectivityActionsType, State } from "./types";

type ConnectivityActions = ActionType<typeof actions>;

const initialState: State = {
	offline: false // !navigator.onLine
};

export function reduceConnectivity(state = initialState, { type }: ConnectivityActions) {
	switch (type) {
		case ConnectivityActionsType.Offline:
			return { ...state, offline: true };
		case ConnectivityActionsType.Online:
			return { ...state, offline: false };
		default:
			return state;
	}
}
