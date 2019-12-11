import { ActionType } from "../common";
import * as actions from "./actions";
import { PreferencesActionsType, PreferencesState } from "./types";
import { merge } from "lodash-es";

type PreferencesActions = ActionType<typeof actions>;

const initialState: PreferencesState = {};

export function reducePreferences(state = initialState, action: PreferencesActions) {
	switch (action.type) {
		case PreferencesActionsType.Set:
		case PreferencesActionsType.Update:
			return merge({}, state, action.payload);
		case "RESET":
			return initialState;
		default:
			return state;
	}
}
