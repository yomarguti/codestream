import { ActionType } from "../common";
import * as actions from "./actions";

type CapabilitiesActions = ActionType<typeof actions>;

export interface CapabilitiesState {
	[name: string]: boolean;
}

const initialState: CapabilitiesState = {};

export function reduceCapabilities(state = initialState, { type, payload }: CapabilitiesActions) {
	switch (type) {
		case "UPDATE_CAPABILITIES":
			return { ...state, ...payload };
		default:
			return state;
	}
}
