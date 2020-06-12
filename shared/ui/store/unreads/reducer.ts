import { ActionType } from "../common";
import * as actions from "./actions";
import { UnreadsState, UnreadsActionsType } from "./types";

type UnreadsActions = ActionType<typeof actions>;

const initialState: UnreadsState = {
	lastReads: {},
	mentions: {},
	unreads: {},
	totalUnreads: 0,
	totalMentions: 0
};

export function reduceUnreads(state = initialState, action: UnreadsActions) {
	switch (action.type) {
		case UnreadsActionsType.Update: {
			const { payload } = action;
			return {
				totalMentions: payload.totalMentions,
				totalUnreads: payload.totalUnreads,
				lastReads: { ...state.lastReads, ...payload.lastReads },
				mentions: payload.mentions,
				unreads: payload.unreads
			};
		}
		case UnreadsActionsType.ResetLastReads: {
			return { ...state, lastReads: {} };
		}
		case "RESET":
			return initialState;
		default:
			return state;
	}
}
