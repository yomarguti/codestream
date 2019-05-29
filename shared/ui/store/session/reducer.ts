import { ActionType } from "../common";
import * as actions from "./actions";
import { SessionActionType, SessionState } from "./types";

type SessionActions = ActionType<typeof actions>;

const initialState: SessionState = {};

export function reduceSession(state = initialState, action: SessionActions) {
	switch (action.type) {
		case SessionActionType.Set:
			return { ...state, ...action.payload };
		case "RESET":
			return initialState;
		default:
			return state;
	}
}
