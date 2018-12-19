import { ActionType } from "../common";
import * as actions from "./actions";
import { PreferencesActionsType, State } from "./types";

type PreferencesActions = ActionType<typeof actions>;

const initialState: State = {};

export function reducePreferences(state = initialState, action: PreferencesActions) {
	switch (action.type) {
		case PreferencesActionsType.Update:
			return { ...state, ...action.payload };
		case "RESET":
			return initialState;
		default:
			return state;
	}
}
