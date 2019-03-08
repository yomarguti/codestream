import { ActionType } from "../common";
import * as actions from "./actions";
import { State, ProvidersActionsType } from "./types";

type ProviderActions = ActionType<typeof actions>;

const initialState: State = {};

export function reduceProviders(state = initialState, action: ProviderActions) {
	switch (action.type) {
		case "RESET":
			return initialState;
		case ProvidersActionsType.Update: {
			const { payload } = action;
			return {
				providers: payload
			};
		}
		default:
			return state;
	}
}
