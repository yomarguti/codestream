import { ActionType } from "../common";
import * as actions from "./actions";
import { PreferencesActionsType, State } from "./types";

type PreferencesActions = ActionType<typeof actions>;

const initialState: State = {};

export function reducePreferences(state = initialState, { type, payload }: PreferencesActions) {
	switch (type) {
		case PreferencesActionsType.Update:
			return { ...state, ...payload };
		default:
			return state;
	}
}
