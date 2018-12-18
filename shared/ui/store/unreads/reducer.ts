import { ActionType } from "../common";
import * as actions from "./actions";
import { State } from "./types";

type UnreadsActionsActions = ActionType<typeof actions>;

const initialState: State = {
	lastReads: {},
	mentions: {},
	unreads: {},
	totalUnreads: 0,
	totalMentions: 0
};

export function reduceUnreads(state = initialState, { type, payload }: UnreadsActionsActions) {
	switch (type) {
		case "UPDATE_UNREADS": {
			return {
				totalMentions: payload.totalMentions,
				totalUnreads: payload.totalUnreads,
				lastReads: { ...state.lastReads, ...payload.lastReads },
				mentions: payload.mentions,
				unreads: payload.unreads
			};
		}
		default:
			return state;
	}
}
