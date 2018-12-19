import { ActionType } from "../common";
import * as actions from "./actions";
import { ServicesActionsType } from "./types";

type ServicesActions = ActionType<typeof actions>;

const initialState = {};

export function reduceServices(state = initialState, { type, payload }: ServicesActions) {
	switch (type) {
		case ServicesActionsType.Bootstrap:
			return { ...payload, ...state };
		default:
			return { ...initialState, ...state };
	}
}
